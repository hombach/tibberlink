"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectUtils = exports.enCalcType = void 0;
exports.getCalcTypeDescription = getCalcTypeDescription;
var enCalcType;
(function (enCalcType) {
    enCalcType[enCalcType["BestCost"] = 1] = "BestCost";
    enCalcType[enCalcType["BestSingleHours"] = 2] = "BestSingleHours";
    enCalcType[enCalcType["BestHoursBlock"] = 3] = "BestHoursBlock";
    enCalcType[enCalcType["BestCostLTF"] = 4] = "BestCostLTF";
    enCalcType[enCalcType["BestSingleHoursLTF"] = 5] = "BestSingleHoursLTF";
    enCalcType[enCalcType["BestHoursBlockLTF"] = 6] = "BestHoursBlockLTF";
    enCalcType[enCalcType["SmartBatteryBuffer"] = 7] = "SmartBatteryBuffer";
    enCalcType[enCalcType["BestPercentage"] = 8] = "BestPercentage";
    enCalcType[enCalcType["BestPercentageLTF"] = 9] = "BestPercentageLTF";
})(enCalcType || (exports.enCalcType = enCalcType = {}));
/**
 * getCalcTypeDescription
 *
 * @param calcType - ID of calculator channel type
 */
function getCalcTypeDescription(calcType) {
    switch (calcType) {
        case enCalcType.BestCost:
            return `best cost`;
        case enCalcType.BestSingleHours:
            return `best single hours`;
        case enCalcType.BestHoursBlock:
            return `best hours block`;
        case enCalcType.BestCostLTF:
            return `best cost LTF`;
        case enCalcType.BestSingleHoursLTF:
            return `best single hours LTF`;
        case enCalcType.BestHoursBlockLTF:
            return `best hours block LTF`;
        case enCalcType.SmartBatteryBuffer:
            return `smart battery buffer`;
        case enCalcType.BestPercentage:
            return `best hours within top x percentage`;
        case enCalcType.BestPercentageLTF:
            return `best hours within top x percentage LTF`;
        default:
            return "Unknown";
    }
}
/**
 * ProjectUtils
 */
class ProjectUtils {
    adapter;
    /**
     * constructor
     *
     * @param adapter - ioBroker adapter instance
     */
    constructor(adapter) {
        this.adapter = adapter;
    }
    /**
     * Retrieves the value of a given state by its name.
     *
     * @param stateName - A string representing the name of the state to retrieve.
     * @returns A Promise that resolves with the value of the state if it exists, otherwise resolves with null.
     */
    async getStateValue(stateName) {
        try {
            const stateObject = await this.getState(stateName);
            return stateObject?.val ?? null; // errors have already been handled in getState()
        }
        catch (error) {
            this.adapter.log.error(`[getStateValue](${stateName}): ${error}`);
            return null;
        }
    }
    /**
     * Retrieves the state object by its name.
     *
     * @param stateName - A string representing the name of the state to retrieve.
     * @returns A Promise that resolves with the object of the state if it exists, otherwise resolves with null.
     */
    async getState(stateName) {
        try {
            if (await this.verifyStateAvailable(stateName)) {
                // Get state value, so like: {val: false, ack: true, ts: 1591117034451, �}
                const stateValueObject = await this.adapter.getStateAsync(stateName);
                if (!this.isLikeEmpty(stateValueObject)) {
                    return stateValueObject;
                }
                throw new Error(`Unable to retrieve info from state '${stateName}'.`);
            }
        }
        catch (error) {
            this.adapter.log.error(`[asyncGetState](${stateName}): ${error}`);
            return null;
        }
    }
    /**
     * Verifies the availability of a state by its name.
     *
     * @param stateName - A string representing the name of the state to verify.
     * @returns A Promise that resolves with true if the state exists, otherwise resolves with false.
     */
    async verifyStateAvailable(stateName) {
        const stateObject = await this.adapter.getObjectAsync(stateName); // Check state existence
        if (!stateObject) {
            this.adapter.log.debug(`[verifyStateAvailable](${stateName}): State does not exist.`);
            return false;
        }
        return true;
    }
    /**
     * Get foreign state value
     *
     * @param stateName - Full path to state, like 0_userdata.0.other.isSummer
     * @returns State value, or null if error
     */
    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    async asyncGetForeignStateVal(stateName) {
        try {
            const stateObject = await this.asyncGetForeignState(stateName);
            if (stateObject == null) {
                return null;
            } // errors thrown already in asyncGetForeignState()
            return stateObject.val;
        }
        catch (error) {
            this.adapter.log.error(`[asyncGetForeignStateValue](${stateName}): ${error}`);
            return null;
        }
    }
    /**
     * Get foreign state
     *
     * @param stateName - Full path to state, like 0_userdata.0.other.isSummer
     * @returns State object: {val: false, ack: true, ts: 1591117034451, …}, or null if error
     */
    async asyncGetForeignState(stateName) {
        try {
            const stateObject = await this.adapter.getForeignObjectAsync(stateName); // Check state existence
            if (!stateObject) {
                throw new Error(`State '${stateName}' does not exist.`);
            }
            else {
                // Get state value, so like: {val: false, ack: true, ts: 1591117034451, …}
                const stateValueObject = await this.adapter.getForeignStateAsync(stateName);
                if (!this.isLikeEmpty(stateValueObject)) {
                    return stateValueObject;
                }
                throw new Error(`Unable to retrieve info from state '${stateName}'.`);
            }
        }
        catch (error) {
            this.adapter.log.error(`[asyncGetForeignState](${stateName}): ${error}`);
            return null;
        }
    }
    /**
     * Checks if the given input variable is effectively empty.
     *
     * This method examines the provided `inputVar` to determine if it contains any meaningful data.
     * It performs a series of transformations to strip out whitespace and common punctuation, then checks if the result is an empty string.
     *
     * @param inputVar - The state variable to check, which can be of type `ioBroker.State`, `null`, or `undefined`.
     * @returns A boolean indicating whether the input variable is considered empty (`true` if empty, `false` otherwise).
     */
    isLikeEmpty(inputVar) {
        if (typeof inputVar !== "undefined" && inputVar !== null) {
            let sTemp = JSON.stringify(inputVar);
            sTemp = sTemp.replace(/\s+/g, ""); // remove all white spaces
            sTemp = sTemp.replace(/"+/g, ""); // remove all >"<
            sTemp = sTemp.replace(/'+/g, ""); // remove all >'<
            sTemp = sTemp.replace(/\[+/g, ""); // remove all >[<
            sTemp = sTemp.replace(/\]+/g, ""); // remove all >]<
            sTemp = sTemp.replace(/\{+/g, ""); // remove all >{<
            sTemp = sTemp.replace(/\}+/g, ""); // remove all >}<
            if (sTemp !== "") {
                return false;
            }
            return true;
        }
        return true;
    }
    /**
     * Checks if a string state exists, creates it if necessary, and updates its value.
     *
     * @param stateName - A string representing the name of the state.
     * @param value - The string value to set for the state.
     * @param description - Optional description for the state (default is "-").
     * @param role - Optional role type for the state (default is "text").
     * @param writeable - Optional boolean indicating if the state should be writeable (default is false).
     * @param dontUpdate - Optional boolean indicating if the state should not be updated if it already exists (default is false).
     * @param forceMode - Optional boolean indicating if the state should be reinitiated if it already exists (default is false).
     * @returns A Promise that resolves when the state is checked, created (if necessary), and updated.
     */
    async checkAndSetValue(stateName, value, description = "-", role = "text", writeable = false, dontUpdate = false, forceMode = false) {
        if (value != undefined) {
            if (value.trim().length > 0) {
                const commonObj = {
                    name: stateName.split(".").pop(),
                    type: "string",
                    role: role,
                    desc: description,
                    read: true,
                    write: writeable,
                };
                if (!forceMode) {
                    await this.adapter.setObjectNotExistsAsync(stateName, {
                        type: "state",
                        common: commonObj,
                        native: {},
                    });
                }
                else {
                    await this.adapter.setObjectAsync(stateName, {
                        type: "state",
                        common: commonObj,
                        native: {},
                    });
                }
                if (!dontUpdate || (await this.adapter.getStateAsync(stateName)) === null) {
                    await this.adapter.setState(stateName, { val: value, ack: true });
                }
            }
        }
    }
    /**
     * Checks if a number state exists, creates it if necessary, and updates its value.
     *
     * @param stateName - A string representing the name of the state.
     * @param value - The number value to set for the state.
     * @param description - Optional description for the state (default is "-").
     * @param unit - Optional unit string to set for the state (default is undefined).
     * @param role - Optional role type for the state (default is "value").
     * @param writeable - Optional boolean indicating if the state should be writeable (default is false).
     * @param dontUpdate - Optional boolean indicating if the state should not be updated if it already exists (default is false).
     * @param forceMode - Optional boolean indicating if the state should be reinitiated if it already exists (default is false).
     * @returns A Promise that resolves when the state is checked, created (if necessary), and updated.
     */
    async checkAndSetValueNumber(stateName, value, description = "-", unit, role = "value", writeable = false, dontUpdate = false, forceMode = false) {
        if (value !== undefined) {
            const commonObj = {
                name: stateName.split(".").pop(),
                type: "number",
                role: role,
                desc: description,
                read: true,
                write: writeable,
            };
            // Add unit only if it's provided and not null or undefined
            if (unit !== null && unit !== undefined) {
                commonObj.unit = unit;
            }
            if (!forceMode) {
                await this.adapter.setObjectNotExistsAsync(stateName, {
                    type: "state",
                    common: commonObj,
                    native: {},
                });
            }
            else {
                await this.adapter.setObjectAsync(stateName, {
                    type: "state",
                    common: commonObj,
                    native: {},
                });
            }
            if (!dontUpdate || (await this.adapter.getStateAsync(stateName)) === null) {
                await this.adapter.setState(stateName, { val: value, ack: true });
            }
        }
    }
    /**
     * Checks if a boolean state exists, creates it if necessary, and updates its value.
     *
     * @param stateName - A string representing the name of the state.
     * @param value - The boolean value to set for the state.
     * @param description - Optional description for the state (default is "-").
     * @param role - Optional role type for the state (default is "indicator").
     * @param writeable - Optional boolean indicating if the state should be writeable (default is false).
     * @param dontUpdate - Optional boolean indicating if the state should not be updated if it already exists (default is false).
     * @param forceMode - Optional boolean indicating if the state should be overwritten if it already exists (default is false).
     * @returns A Promise that resolves when the state is checked, created (if necessary), and updated.
     */
    async checkAndSetValueBoolean(stateName, value, description = "-", role = "indicator", writeable = false, dontUpdate = false, forceMode = false) {
        if (value !== undefined && value !== null) {
            const commonObj = {
                name: stateName.split(".").pop(),
                type: "boolean",
                role: role,
                desc: description,
                read: true,
                write: writeable,
            };
            if (!forceMode) {
                await this.adapter.setObjectNotExistsAsync(stateName, {
                    type: "state",
                    common: commonObj,
                    native: {},
                });
            }
            else {
                await this.adapter.setObjectAsync(stateName, {
                    type: "state",
                    common: commonObj,
                    native: {},
                });
            }
            if (!dontUpdate || (await this.adapter.getStateAsync(stateName)) === null) {
                await this.adapter.setState(stateName, { val: value, ack: true });
            }
        }
    }
    /**
     * Generates a formatted error message based on the provided error object and context.
     *
     * @param error - The error object containing information about the error, such as status and error messages.
     * @param context - A string providing context for where the error occurred.
     * @returns A string representing the formatted error message.
     */
    generateErrorMessage(error, context) {
        let errorMessages = "";
        // Check if error object has an 'errors' property that is an array
        if (error.errors && Array.isArray(error.errors)) {
            // Iterate over the array of errors and concatenate their messages
            for (const err of error.errors) {
                if (errorMessages) {
                    errorMessages += ", ";
                }
                errorMessages += err.message;
            }
        }
        else if (error.message) {
            errorMessages = error.message; // If 'errors' array is not present, use the 'message' property of the error object
        }
        else {
            errorMessages = "Unknown error"; // If no 'errors' or 'message' property is found, default to "Unknown error"
        }
        // Construct the final error message string with status, context, and error messages
        return `Error (${error.statusMessage || error.statusText || "Unknown Status"}) occurred during: -${context}- : ${errorMessages}`;
    }
}
exports.ProjectUtils = ProjectUtils;
//# sourceMappingURL=projectUtils.js.map