const geolib = require("geolib");

const inside = (point, polygon) => {
    return geolib.isPointInPolygon(point, polygon);
};

const pointToPoint = (a, b) => {
    return geolib.getDistance(a, b) / 1000;
};

const pointToLine = (point, line) => {
    const p = [point.longitude, point.latitude];
    const a = [line[0].longitude, line[0].latitude];
    const b = [line[1].longitude, line[1].latitude];

    const atob = [b[0] - a[0], b[1] - a[1]];
    const atop = [p[0] - a[0], p[1] - a[1]];
    const len = atob[0] * atob[0] + atob[1] * atob[1];
    let t = len === 0 ? 0 : (atop[0] * atob[0] + atop[1] * atob[1]) / len;
    t = Math.max(0, Math.min(1, t));
    const closest = {
        latitude: a[1] + atob[1] * t,
        longitude: a[0] + atob[0] * t,
    };

    const distance = geolib.getDistance(point, closest);
    return {
        closest: closest,
        distance: distance,
    };
};

const pointToPolygon = (point, polygon) => {
    if (inside(point, polygon)) {
        return {
            closest: point,
            distance: 0,
        };
    }
    let closestPoint = null;
    let shortestDistance = Infinity;
    for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i];
        const b = polygon[(i + 1) % polygon.length];
        const { closest, distance } = pointToLine(point, [a, b]);
        if (distance < shortestDistance) {
            closestPoint = closest;
            shortestDistance = distance;
        }
    }
    return {
        closest: closestPoint,
        distance: shortestDistance,
    };
};

module.exports = {
    pointToPoint,
    pointToPolygon,
};
