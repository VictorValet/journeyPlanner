const getVehicles = async () => {
    const vehiclesData = await fetch("https://poppy.red/api/v3/cities/a88ea9d0-3d5e-4002-8bbf-775313a5973c/vehicles");
    return await vehiclesData.json();
}

const getParkingZones = async () => {
    const parkingData = await fetch("https://poppy.red/api/v3/geozones/62c4bd62-881c-473e-8a6b-fbedfd276739");
    return await parkingData.json();
}

const getPricing = async (tier) => {
    const pricingData = await fetch(`https://poppy.red/api/v3/pricing/pay-per-use?modelType=car&tier=${tier}`);
    return await pricingData.json();
}

module.exports = {
    getVehicles,
    getParkingZones,
    getPricing
};
