function ok(res, data = null, message = "OK", status = 200) {
    return res.status(status).json({
        success: true,
        message,
        data,
    });
}

function fail(res, message = "Bad Request", status = 400, errorCode = "BAD_REQUEST") {
    return res.status(status).json({
        success: false,
        error_code: errorCode,
        message,
    });
}

module.exports = { ok, fail };
