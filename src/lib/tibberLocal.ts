import * as utils from "@iobroker/adapter-core";
import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import { TibberHelper } from "./tibberHelper";

export class TibberLocal extends TibberHelper {
	intervalList: NodeJS.Timeout[];
	TestData: string = "";
	TestMode: boolean = false;
	MetricsDataInterval: number = 60000;
	RawDataInterval: number = 2000;
	/*    TibberLocaleConfig = {
	    //negSignPattern: "77070100010800ff6301a",
    };*/
	obisCodesWithNames = [
		{ code: "0100100700ff", name: "Power" },
		{ code: "01000f0700ff", name: "Power", checkSign: true },
		{ code: "0100010800ff", name: "Import_total" },
		{ code: "0100010801ff", name: "Import_total_Tarif_1" },
		{ code: "0100010802ff", name: "Import_total_Tarif_2" },
		{ code: "0100020800ff", name: "Export_total" },
		{ code: "0100010800ff_in_k", name: "Import_total_(kWh)" },
		{ code: "0100020800ff_in_k", name: "Export_total_(kWh)" },
		{ code: "0100240700ff", name: "Power_L1" },
		{ code: "0100380700ff", name: "Power_L2" },
		{ code: "01004c0700ff", name: "Power_L3" },
		{ code: "0100200700ff", name: "Potential_L1" },
		{ code: "0100340700ff", name: "Potential_L2" },
		{ code: "0100480700ff", name: "Potential_L3" },
		{ code: "01001f0700ff", name: "Current_L1" },
		{ code: "0100330700ff", name: "Current_L2" },
		{ code: "0100470700ff", name: "Current_L3" },
		{ code: "01000e0700ff", name: "Net_frequency" },
		{ code: "0100510701ff", name: "Potential_Phase_deviation_L1/L2" },
		{ code: "0100510702ff", name: "Potential_Phase_deviation_L1/L3" },
		{ code: "0100510704ff", name: "Current/Potential_L1_Phase_deviation" },
		{ code: "010051070fff", name: "Current/Potential_L2_Phase_deviation" },
		{ code: "010051071aff", name: "Current/Potential_L3_Phase_deviation" },
	];

	constructor(adapter: utils.AdapterInstance) {
		super(adapter);
		this.intervalList = [];
	}

	async setupOnePulseLocal(pulse: number): Promise<void> {
		try {
			if (this.adapter.config.PulseList[pulse].puName === undefined) {
				this.adapter.config.PulseList[pulse].puName = `Pulse Local`;
			}
			//const pulseName = this.adapter.config.PulseList[pulse].puName;

			if (!this.TestMode) {
				const jobBridgeMetrics = setInterval(() => {
					this.adapter.log.warn(`Calling Bridge metrics data`); // WiP
					this.getPulseData(pulse)
						.then((response) => {
							this.adapter.log.debug(`Got Bridge metrics data: ${response}`);
							this.generateAndSyncSub(pulse, "Data", JSON.parse(response));
						})
						.catch((e) => {
							this.adapter.log.warn(`Error polling and parsing Tibber Bridge metrics data: ${e}`);
						});
				}, this.MetricsDataInterval);
				if (jobBridgeMetrics) this.intervalList.push(jobBridgeMetrics);

				const jobPulseLocal = setInterval(() => {
					// poll data and log as HEX string
					this.getDataAsHexString(pulse)
						.then((hexString) => {
							this.extractAndParseSMLMessages(pulse, hexString);
							this.adapter.log.debug(`got HEX data from local pulse: ${hexString}`); // log data as HEX string
							this.checkAndSetValue(this.getStatePrefixLocal(pulse, "SMLDataHEX"), hexString, this.adapter.config.PulseList[pulse].puName);
						})
						.catch((e) => {
							this.adapter.log.warn(`Error local polling of Tibber Pulse RAW data: ${e}`);
						});
				}, this.RawDataInterval);
				if (jobPulseLocal) this.intervalList.push(jobPulseLocal);
			} else {
				const parsedMessages = this.extractAndParseSMLMessages(99, this.TestData);
				this.adapter.log.warn(`Parsed messages from test data ${parsedMessages}`);
			}
		} catch (error) {
			this.adapter.log.warn(this.generateErrorMessage(error, `setup of Bridge / Pulse local poll`));
		}
	}

	async clearIntervals(): Promise<void> {
		try {
			// Here we must clear all intervals that may still be active
			for (const intervalJob of this.intervalList) {
				clearInterval(intervalJob);
			}
		} catch (e) {
			this.adapter.log.warn((e as Error).message);
		}
	}

	private async getPulseData(pulse: number): Promise<string> {
		const auth = `Basic ${Buffer.from(`admin:${this.adapter.config.PulseList[pulse].tibberBridgePassword}`).toString("base64")}`;
		const options: AxiosRequestConfig = {
			method: "GET",
			url: `http://${this.adapter.config.PulseList[pulse].tibberBridgeUrl}/metrics.json?node_id=${this.adapter.config.PulseList[pulse].tibberPulseLocalNodeId}`,
			headers: {
				Authorization: auth,
				Host: this.adapter.config.PulseList[pulse].tibberBridgeUrl,
				lang: "de-de",
				"Content-Type": "application/json",
				"User-Agent": "okhttp/3.14.9",
			},
		};

		try {
			const response: AxiosResponse<string> = await axios(options);
			return response.data.replace("$type", "type"); // adapt answear to return
		} catch (error) {
			console.error("Ein Fehler beim Abruf der metrics (getPulseData).");
			throw error;
		}
	}
	private generateAndSyncSub(pulse: number, id: string, JElements: any, preset: string = "empty"): void {
		if (!JElements || typeof JElements !== "object") {
			this.adapter.log.warn(`Ungültige JElements übergeben!: ${JElements}`); //
			return;
		}
		for (const JElement in JElements) {
			if (typeof JElements[JElement] === "object") {
				if (id === "") {
					this.generateAndSyncSub(pulse, JElement, JElements[JElement], preset);
				} else {
					this.generateAndSyncSub(pulse, `${id}.${JElement}`, JElements[JElement], preset);
				}
			} else {
				// Check for element name "timestamp"
				if (JElement === "timestamp") {
					const TimeValue = this.isValidUnixTimestampAndConvert(JElements[JElement]);
					if (TimeValue) JElements[JElement] = TimeValue;
				}
				this.checkAndSetValue(this.getStatePrefixLocal(pulse, id), JElement, this.adapter.config.PulseList[pulse].puName);
			}
		}
	}

	private async getDataAsHexString(pulse: number): Promise<string> {
		const auth = `Basic ${Buffer.from(`admin:${this.adapter.config.PulseList[pulse].tibberBridgePassword}`).toString("base64")}`;
		const options: AxiosRequestConfig = {
			method: "GET",
			url: `http://${this.adapter.config.PulseList[pulse].tibberBridgeUrl}/data.json?node_id=${this.adapter.config.PulseList[pulse].tibberPulseLocalNodeId}`,
			headers: {
				Authorization: auth,
			},
			responseType: "arraybuffer", // Wichtig für den Umgang mit Binärdaten
		};

		try {
			const response: AxiosResponse<ArrayBuffer> = await axios(options);
			const buffer = Buffer.from(response.data);
			const hexString = buffer.toString("hex");
			return hexString;
		} catch (error) {
			this.adapter.log.error(`An error occured during local poll of Pulse data (getDataAsHexString)`);
			throw error;
		}
	}
	private async extractAndParseSMLMessages(pulse: number, transfer: string): Promise<void> {
		interface SmlResult {
			name: string;
			value: number;
			unit?: string;
		}
		//const messages = transfer.matchAll(/7707(0100[0-9a-fA-F].{5}?ff)(?:.{6}|.{14}|.{20}|.{26})([0-9a-fA-F]{2})52([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{4,16})01(?=(7)|(0101)|(\n))/g);
		const messages = transfer.matchAll(
			/7707(0100[0-9a-fA-F].{5}?ff).{4,28}62([0-9a-fA-F]{2})52([0-9a-fA-F]{2})([0-9a-fA-F]{2})((?:[0-9a-fA-F]{2}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8}|[0-9a-fA-F]{10}|[0-9a-fA-F]{8}|[0-9a-fA-F]{16}))01(?=(77)|(0101)|(\n))/g,
		);
		const output: string[] = [];
		for (const match of messages) {
			const result: SmlResult = { name: "", value: 0 };
			this.adapter.log.debug(`Gesamte Übereinstimmung: ${match[0]}`);
			//console.log(`Gruppe 1: ${match[1]}`); // Der Teil, der dem ersten Klammerausdruck entspricht
			//console.log(`Gruppe 2: ${match[2]}`); // Der Teil, der dem zweiten Klammerausdruck entspricht
			//console.log(`Gruppe 3: $[match[3]}`); // Der Teil, der dem dritten Klammerausdruck entspricht
			//console.log(`Gruppe 4: $[match[4]}`); // Der Teil, der dem dritten Klammerausdruck entspricht
			//console.log(`Gruppe 5: ${match[5]}`); // Der Teil, der dem vierten Klammerausdruck entspricht

			result.name = findObisCodeName(match[1], this.obisCodesWithNames);
			result.value = parseSignedHex(match[5]);
			const decimalCode = parseInt(match[2], 16);
			result.unit = findDlmsUnitByCode(decimalCode);

			if (match[3].toLowerCase() == "ff") {
				result.value = result.value / 10;
			} else if (match[3].toLowerCase() == "fe") {
				result.value = result.value / 100;
			}
			/*
            if ("negSignPattern" in TibberConfig && TibberConfig.negSignPattern.length > 2) {
				const obisCodeOb = obisCodesWithNames.find((item) => item.code === match[1]);
				if (obisCodeOb) {
					if (obisCodeOb.checkSign) {
						if (transfer.includes(TibberConfig.negSignPattern)) {
							//log(`Negativ!!!!`)
							result.value = result.value * -1;
						}
					}
				}
			}
            */
			if (result.value > 1000000000 || result.value < -1000000000) {
				this.adapter.log.debug(`Result.value < or > 1.000.000.000 skiped!`);
				this.adapter.log.debug(JSON.stringify(result));
				this.adapter.log.debug(`Gesamte Übereinstimmung: ${match[0]}`);
				this.adapter.log.debug(`RAW: ${transfer}`);
				continue;
			}
			this.checkAndSetValueNumber(this.getStatePrefixLocal(pulse, result.name), result.value, this.adapter.config.PulseList[pulse].puName, result.unit);
			this.adapter.log.debug(JSON.stringify(result));
			const formattedMatch = match[0].replace(/(..)/g, "$1 ").trim();
			output.push(getCurrentTimeFormatted() + " : " + formattedMatch + "\n");
		}
		if (output.length > 0) this.adapter.log.debug(`Format for https://tasmota-sml-parser.dicp.net :\n${output.join("")}`);
	}

	private isValidUnixTimestampAndConvert(n: number): false | string {
		// Typüberprüfung und Bereichsüberprüfung (optional)
		const currentTime = Math.floor(Date.now() / 1000);
		if (typeof n !== "number" || n < 0 || n > currentTime || !Number.isInteger(n)) {
			return false;
		}
		// Konvertiere zu deutschem Zeitformat
		const date = new Date(n * 1000);
		return date.toLocaleString("de-DE");
	}
}

/*
function swapEndianness(hexStr: string): string {
	const result = [];
	for (let i = 0; i < hexStr.length; i += 2) {
		result.unshift(hexStr.substring(i, i + 2));
	}
	return result.join("");
}
*/

/*
function isState2(strStatePath: string, strict = true): boolean {
	let mSelector;
	if (strict) {
		mSelector = $(strStatePath);
	} else {
		mSelector = $(strStatePath + "*");
	}
	if (mSelector.length > 0) {
		return true;
	} else {
		return false;
	}
}
*/

function parseSignedHex(hexStr: string): number {
	let num = BigInt(`0x${hexStr}`);
	const bitLength = hexStr.length * 4;
	if (bitLength <= 4) {
		// Behandlung als 4-Bit-Zahl
		if (num > 0x7) {
			num = num - 0x1n;
		}
	} else if (bitLength <= 8) {
		// Behandlung als 8-Bit-Zahl
		if (num > 0x7f) {
			num = num - 0x100n;
		}
	} else if (bitLength <= 16) {
		// Behandlung als 16-Bit-Zahl
		if (num > 0x7fff) {
			num = num - 0x10000n;
		}
	} else if (bitLength <= 24) {
		// Behandlung als 16-Bit-Zahl
		if (num > 0x7fffff) {
			num = num - 0x1000000n;
		}
	} else if (bitLength <= 32) {
		// Behandlung als 32-Bit-Zahl
		if (num > 0x7fffffff) {
			num = num - 0x100000000n;
		}
	} else {
		// Behandlung als 64-Bit-Zahl
		if (num > 0x7fffffffffffffffn) {
			num = num - 0x10000000000000000n;
		}
	}
	return Number(num.toString());
}

/*
function parseSignedHex(hexStr: string): number {
    let num = BigInt(`0x${hexStr}`);
    const bitLength = hexStr.length * 4;
    const thresholds: [number, bigint][] = [
        [4, 0x8n],
        [8, 0x80n],
        [16, 0x8000n],
        [24, 0x800000n],
        [32, 0x80000000n],
        [64, 0x8000000000000000n]
    ];

    for (const [bits, threshold] of thresholds) {
        if (bitLength <= bits) {
            const offset = 1n << BigInt(bits);
            if (num >= threshold) {
                num -= offset;
            }
            break;
        }
    }
    return Number(num);
}
*/

function getCurrentTimeFormatted(): string {
	const now = new Date();
	return (
		now.getHours().toString().padStart(2, "0") +
		":" +
		now.getMinutes().toString().padStart(2, "0") +
		":" +
		now.getSeconds().toString().padStart(2, "0") +
		"." +
		now.getMilliseconds().toString().padStart(3, "0")
	);
}

function findDlmsUnitByCode(decimalCode: number): string {
	/* Static lookup table */
	const dlmsUnits = [
		{ code: 0x1, unit: "a", quantity: "time", unitName: "year", siDefinition: "52*7*24*60*60 s" },
		{ code: 0x2, unit: "mo", quantity: "time", unitName: "month", siDefinition: "31*24*60*60 s" },
		{ code: 0x3, unit: "wk", quantity: "time", unitName: "week", siDefinition: "7*24*60*60 s" },
		{ code: 0x4, unit: "d", quantity: "time", unitName: "day", siDefinition: "24*60*60 s" },
		{ code: 0x5, unit: "h", quantity: "time", unitName: "hour", siDefinition: "60*60 s" },
		{ code: 0x6, unit: "min.", quantity: "time", unitName: "min", siDefinition: "60 s" },
		{ code: 0x7, unit: "s", quantity: "time", unitName: "second", siDefinition: "s" },
		{ code: 0x8, unit: "Â°", quantity: "phase angle", unitName: "degree", siDefinition: "rad*180/Ï€" },
		{ code: 0x9, unit: "Â°C", quantity: "temperature", unitName: "degree celsius", siDefinition: "K-273.15" },
		{ code: 0xa, unit: "currency", quantity: "local currency", unitName: "", siDefinition: "" },
		{ code: 0xb, unit: "m", quantity: "length", unitName: "metre", siDefinition: "m" },
		{ code: 0xc, unit: "m/s", quantity: "speed", unitName: "metre per second", siDefinition: "m/s" },
		{ code: 0xd, unit: "mÂ³", quantity: "volume", unitName: "cubic metre", siDefinition: "mÂ³" },
		{ code: 0xe, unit: "mÂ³", quantity: "corrected volume", unitName: "cubic metre", siDefinition: "mÂ³" },
		{ code: 0xf, unit: "mÂ³/h", quantity: "volume flux", unitName: "cubic metre per hour", siDefinition: "mÂ³/(60*60s)" },
		{ code: 0x10, unit: "mÂ³/h", quantity: "corrected volume flux", unitName: "cubic metre per hour", siDefinition: "mÂ³/(60*60s)" },
		{ code: 0x11, unit: "mÂ³/d", quantity: "volume flux", unitName: "cubic metre per day", siDefinition: "mÂ³/(24*60*60s)" },
		{ code: 0x12, unit: "mÂ³/d", quantity: "corrected volume flux", unitName: "cubic metre per day", siDefinition: "mÂ³/(24*60*60s)" },
		{ code: 0x13, unit: "l", quantity: "volume", unitName: "litre", siDefinition: "10-3 mÂ³" },
		{ code: 0x14, unit: "kg", quantity: "mass", unitName: "kilogram", siDefinition: "" },
		{ code: 0x15, unit: "N", quantity: "force", unitName: "newton", siDefinition: "" },
		{ code: 0x16, unit: "Nm", quantity: "energy", unitName: "newtonmeter", siDefinition: "J = Nm = Ws" },
		{ code: 0x17, unit: "Pa", quantity: "pressure", unitName: "pascal", siDefinition: "N/mÂ²" },
		{ code: 0x18, unit: "bar", quantity: "pressure", unitName: "bar", siDefinition: "10âµ N/mÂ²" },
		{ code: 0x19, unit: "J", quantity: "energy", unitName: "joule", siDefinition: "J = Nm = Ws" },
		{ code: 0x1a, unit: "J/h", quantity: "thermal power", unitName: "joule per hour", siDefinition: "J/(60*60s)" },
		{ code: 0x1b, unit: "W", quantity: "active power", unitName: "watt", siDefinition: "W = J/s" },
		{ code: 0x1c, unit: "VA", quantity: "apparent power", unitName: "volt-ampere", siDefinition: "" },
		{ code: 0x1d, unit: "var", quantity: "reactive power", unitName: "var", siDefinition: "" },
		{ code: 0x1e, unit: "Wh", quantity: "active energy", unitName: "watt-hour", siDefinition: "W*(60*60s)" },
		{ code: 0x1f, unit: "VAh", quantity: "apparent energy", unitName: "volt-ampere-hour", siDefinition: "VA*(60*60s)" },
		{ code: 0x20, unit: "varh", quantity: "reactive energy", unitName: "var-hour", siDefinition: "var*(60*60s)" },
		{ code: 0x21, unit: "A", quantity: "current", unitName: "ampere", siDefinition: "A" },
		{ code: 0x22, unit: "C", quantity: "electrical charge", unitName: "coulomb", siDefinition: "C = As" },
		{ code: 0x23, unit: "V", quantity: "voltage", unitName: "volt", siDefinition: "V" },
		{ code: 0x24, unit: "V/m", quantity: "electric field strength", unitName: "volt per metre", siDefinition: "" },
		{ code: 0x25, unit: "F", quantity: "capacitance", unitName: "farad", siDefinition: "C/V = As/V" },
		{ code: 0x26, unit: "Î©", quantity: "resistance", unitName: "ohm", siDefinition: "Î© = V/A" },
		{ code: 0x27, unit: "Î©mÂ²/m", quantity: "resistivity", unitName: "Î©m", siDefinition: "" },
		{ code: 0x28, unit: "Wb", quantity: "magnetic flux", unitName: "weber", siDefinition: "Wb = Vs" },
		{ code: 0x29, unit: "T", quantity: "magnetic flux density", unitName: "tesla", siDefinition: "Wb/m2" },
		{ code: 0x2a, unit: "A/m", quantity: "magnetic field strength", unitName: "ampere per metre", siDefinition: "A/m" },
		{ code: 0x2b, unit: "H", quantity: "inductance", unitName: "henry", siDefinition: "H = Wb/A" },
		{ code: 0x2c, unit: "Hz", quantity: "frequency", unitName: "hertz", siDefinition: "1/s" },
		{ code: 0x2d, unit: "1/(Wh)", quantity: "R_W", unitName: "Active energy meter constant or pulse value", siDefinition: "" },
		{ code: 0x2e, unit: "1/(varh)", quantity: "R_B", unitName: "reactive energy meter constant or pulse value", siDefinition: "" },
		{ code: 0x2f, unit: "1/(VAh)", quantity: "R_S", unitName: "apparent energy meter constant or pulse value", siDefinition: "" },
		{ code: 0x30, unit: "VÂ²h", quantity: "volt-squared hour", unitName: "volt-squaredhours", siDefinition: "VÂ²(60*60s)" },
		{ code: 0x31, unit: "AÂ²h", quantity: "ampere-squared hour", unitName: "ampere-squaredhours", siDefinition: "AÂ²(60*60s)" },
		{ code: 0x32, unit: "kg/s", quantity: "mass flux", unitName: "kilogram per second", siDefinition: "kg/s" },
		{ code: 0x33, unit: "S, mho", quantity: "conductance siemens", unitName: "siemens", siDefinition: "1/Î©" },
		{ code: 0x34, unit: "K", quantity: "temperature", unitName: "kelvin", siDefinition: "" },
		{ code: 0x35, unit: "1/(VÂ²h)", quantity: "", unitName: "Volt-squared hour meter constant or pulse value", siDefinition: "" },
		{ code: 0x36, unit: "1/(AÂ²h)", quantity: "", unitName: "Ampere-squared hour meter constant or pulse value", siDefinition: "" },
		{ code: 0x37, unit: "1/mÂ³", quantity: "R_V", unitName: "meter constant or pulse value (volume)", siDefinition: "" },
		{ code: 0x38, unit: "%", quantity: "percentage", unitName: "%", siDefinition: "" },
		{ code: 0x39, unit: "Ah", quantity: "ampere-hours", unitName: "ampere-hour", siDefinition: "" },
		{ code: 0x3c, unit: "Wh/mÂ³", quantity: "energy per volume", unitName: "", siDefinition: "3,6*103 J/mÂ³" },
		{ code: 0x3d, unit: "J/mÂ³", quantity: "calorific value, wobbe", unitName: "", siDefinition: "" },
		{ code: 0x3e, unit: "Mol %", quantity: "molar fraction of", unitName: "mole percent", siDefinition: "Basic gas composition unit" },
		{ code: 0x3f, unit: "Wh/mÂ³", quantity: "energy per volume", unitName: "", siDefinition: "3,6*103 J/mÂ³" },
		{ code: 0x40, unit: "(reserved)", quantity: "", unitName: "", siDefinition: "" },
		{ code: 0x41, unit: "(other)", quantity: "", unitName: "", siDefinition: "" },
		{ code: 0x42, unit: "(unitless)", quantity: "no unit, unitless, count", unitName: "", siDefinition: "" },
		{ code: 0x0, unit: "", quantity: "", unitName: "", siDefinition: "stop condition for iterator" },
	];
	const found = dlmsUnits.find((item) => item.code === decimalCode);
	return found ? found.unit : "";
}

function findObisCodeName(code: string, obisCodesWithNames: any): string {
	const found = obisCodesWithNames.find((item: any) => item.code === code);
	return found ? found.name : "Unbekannt";
}
