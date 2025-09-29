const isIso8601 = (str) => {
    return typeof str === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(str);
}

const raiseForDataError = (data) => {
    if (!Array.isArray(data)) {
        const err = new Error("Request body must be an array.");
        err.status = 400;
        throw err;
    }
    for (const [i, leg] of data.entries()) {
        if (
            !isIso8601(leg.timestamp) ||
            !leg.start || typeof leg.start.latitude !== "number" || typeof leg.start.longitude !== "number" ||
            !leg.end || typeof leg.end.latitude !== "number" || typeof leg.end.longitude !== "number"
        ) {
            const err = new Error(`Invalid leg format at index ${i}.`);
            err.status = 400;
            throw err;
        }
    }
}

module.exports = {
    raiseForDataError
};
