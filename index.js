const { getVehicles, getPricing, getParkingZones } = require('./fetchData')
const { pointToPoint, pointToPolygon } = require('./geometry');
const { raiseForDataError } = require("./validateInput")
const express = require("express");

const app = express();
const PORT = 5000;

app.use(express.json());

const CONSTANTS = {
    WALK_SPEED_KMH: 5,
    DRIVE_SPEED_PARKING_KMH: 25,
    THOUSANDTHS_TO_UNITS: 1 / 1000,
    MILLISECONDS_TO_MINUTE: 1 / 60000,
    MINUTES_TO_HOUR: 1 / 60,
    HOURS_TO_DAY: 1 / 24,
    FREE_BOOKING_MINUTES: 15,
    INC_VAT: 1.21
};

const toLatLng = obj => ({
    latitude: obj.locationLatitude,
    longitude: obj.locationLongitude
});

const formatPolygonCoordinates = coords => ({
    latitude: coords[1],
    longitude: coords[0]
});

const getClosestCar = (point, vehicles) => {
    const carsWithDistance = vehicles
        .filter(vehicle => vehicle.model.type === "car")
        .map(vehicle => ({
            vehicle,
            distance: pointToPoint(point, toLatLng(vehicle))
        }));
    return carsWithDistance.reduce((min, curr) =>
        curr.distance < min.distance ? curr : min,
        { vehicle: null, distance: Infinity }
    );
};

const getClosestParkingZone = (point, parkingZones) => {
    let closestZone = null;
    let closestPoint = null;
    let shortestDistance = Infinity;

    for (const zone of parkingZones) {
        if (zone.geofencingType === "parking") {
            const multiPolygons = zone.geom.geometry.coordinates;
            for (const multiPolygon of multiPolygons) {
                for (const polygon of multiPolygon) {
                    const converted = polygon.map(formatPolygonCoordinates);
                    const { closest, distance } = pointToPolygon(point, converted);
                    if (distance < shortestDistance) {
                        closestZone = zone;
                        closestPoint = closest;
                        shortestDistance = distance;
                    }
                }
            }
        }
    }
    return { zone: closestZone, point: closestPoint, distance: shortestDistance }
};

const getCarForLeg = (carToKeep, start, vehicles) => {
    return carToKeep || getClosestCar(start, vehicles);
};

const getCarStartPosition = (previousStop, car) => {
    return previousStop || toLatLng(car.vehicle);
};

const calculateTimes = (car, carStartPosition, leg, parking) => {
    const walkSpeed = CONSTANTS.WALK_SPEED_KMH * CONSTANTS.MINUTES_TO_HOUR;
    const driveSpeed = CONSTANTS.DRIVE_SPEED_PARKING_KMH * CONSTANTS.MINUTES_TO_HOUR;
    const distanceCarToStart = car.distance;
    const timeStartToCar = car.distance / walkSpeed;
    const distanceCarToStop = pointToPoint(carStartPosition, leg.end);
    const timeCarToStop = distanceCarToStop / driveSpeed;
    const distanceStopToDst = pointToPoint(parking.point, leg.end);
    const timeStopToDst = distanceStopToDst / walkSpeed;
    return {
        distanceCarToStart, timeStartToCar,
        distanceCarToStop, timeCarToStop,
        distanceStopToDst, timeStopToDst
    };
};

const computeLeg = (leg, vehicles, parkingZones, carToKeep, previousStop) => {
    const car = getCarForLeg(carToKeep, leg.start, vehicles);
    const carStartPosition = getCarStartPosition(previousStop, car);
    const parking = getClosestParkingZone(leg.end, parkingZones);
    const endInAParkingZone = parking.distance === 0;
    const times = calculateTimes(car, carStartPosition, leg, parking);
    return {
        timestamp: Date.parse(leg.timestamp) * CONSTANTS.MILLISECONDS_TO_MINUTE,
        start: leg.start,
        stop: parking.point,
        end: leg.end,
        ...times,
        endInAParkingZone,
        car: car.vehicle
    };
};

const computeJourney = (input, vehicles, parkingZones) => {
    const journey = [];
    for (const [i, legData] of input.entries()) {
        const prevLeg = journey[i - 1];
        const carToKeep = (i > 0 && !prevLeg.endInAParkingZone)
            ? { distance: 0, vehicle: prevLeg.car }
            : null;
        const previousStop = (i > 0 && !prevLeg.endInAParkingZone)
            ? prevLeg.end
            : null;
        const leg = computeLeg(legData, vehicles, parkingZones, carToKeep, previousStop);
        leg.closeReservation = (i === input.length - 1 || leg.endInAParkingZone);
        journey.push(leg);
    }
    return journey;
};

const getPricings = async (journey) => {
    const pricings = {};
    for (const leg of journey) {
        if (!(leg.car.model.tier in pricings)) {
            pricings[leg.car.model.tier] = await getPricing(leg.car.model.tier);
        }
    }
    return pricings;
};

const initPriceUnits = () => ({
    minutes: 0,
    kilometers: 0,
    bookUnits: 0,
    pauseUnits: 0,
    hourCap: 0,
    dayCap: 0
});

const updatePriceUnits = (units, leg, rowIndex, pauseStart) => {
    units.minutes += leg.timeCarToStop;
    units.kilometers += leg.distanceCarToStop;
    if (rowIndex === 0) {
        units.bookUnits = Math.max(leg.timeStartToCar - CONSTANTS.FREE_BOOKING_MINUTES, 0);
    }
    if (pauseStart) {
        units.pauseUnits += (leg.timestamp + leg.timeStartToCar) - pauseStart;
    }
    if (units.minutes >= 1 / (CONSTANTS.MINUTES_TO_HOUR)) units.hourCap = 1;
    if (units.minutes >= 1 / (CONSTANTS.MINUTES_TO_HOUR * CONSTANTS.HOURS_TO_DAY)) units.dayCap = 1;
};

const getLegPrice = (units, pricing) => {
    let price = 0;
    price += pricing.unlockFee;
    price += pricing.minutePrice * units.minutes;
    price += pricing.kilometerPrice * Math.max(units.kilometers - pricing.includedKilometers, 0);
    price += pricing.bookUnitPrice * units.bookUnits;
    price += pricing.pauseUnitPrice * units.pauseUnits;
    price += pricing.hourCapPrice * units.hourCap;
    price += pricing.dayCapPrice * units.dayCap;
    return price;
};

const computePrices = (journey, pricings) => {
    const prices = {
        pricingPerMinute: 0,
        pricingPerKilometer: 0
    };
    let rowIndex = 0;
    let pauseStart = null;
    let units = initPriceUnits();

    for (const [i, leg] of journey.entries()) {
        updatePriceUnits(units, leg, rowIndex, pauseStart);
        if (leg.closeReservation) {
            for (const type of Object.keys(prices)) {
                prices[type] += getLegPrice(units, pricings[leg.car.model.tier][type])
            }
            rowIndex = 0;
            pauseStart = null;
            units = initPriceUnits();
        } else {
            rowIndex += 1;
            pauseStart = leg.timestamp + leg.timeStartToCar + leg.timeCarToStop;
        }
    }
    prices.pricingPerMinute *= CONSTANTS.INC_VAT * CONSTANTS.THOUSANDTHS_TO_UNITS;
    prices.pricingPerKilometer *= CONSTANTS.INC_VAT * CONSTANTS.THOUSANDTHS_TO_UNITS;
    return prices;
};

app.post("/costEstimation", async (req, res) => {
    try {
        raiseForDataError(req.body)
        const vehicles = await getVehicles();
        const parkingZones = await getParkingZones();
        const journey = computeJourney(req.body, vehicles, parkingZones);
        const pricings = await getPricings(journey);
        const prices = computePrices(journey, pricings);
        const bestChoice = prices.pricingPerMinute < prices.pricingPerKilometer
            ? "pricingPerMinute"
            : "pricingPerKilometer";
        res.status(200).send({
            bestChoice,
            ...prices
        });
    } catch (error) {
        res.status(error.status || 500).json({
            error: error.message || "Failed to estimate journey's cost"
        });
    }
})

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
})
