// This file extends the AdapterConfig type from "@types/iobroker"
import { enCalcType } from "./lib/tibberHelper";

// Augment the globally declared type ioBroker.AdapterConfig
declare global {
	namespace ioBroker {
		interface AdapterConfig {
			TibberAPIToken: string;
			HomesList: [
				{
					feedActive: boolean;
					homeID: string;
					statsActive: boolean;
					numberConsHourly: number;
					numberConsDaily: number;
					numberConsWeekly: number;
					numberConsMonthly: number;
					numberConsAnnual: number;
				},
			];
			FeedConfigLastMeterConsumption: boolean;
			FeedConfigAccumulatedConsumption: boolean;
			FeedConfigAccumulatedProduction: boolean;
			FeedConfigAccumulatedConsumptionLastHour: boolean;
			FeedConfigAccumulatedProductionLastHour: boolean;
			FeedConfigAccumulatedCost: boolean;
			FeedConfigAccumulatedReward: boolean;
			FeedConfigCurrency: boolean;
			FeedConfigMinPower: boolean;
			FeedConfigAveragePower: boolean;
			FeedConfigMaxPower: boolean;
			FeedConfigPowerProduction: boolean;
			FeedConfigMinPowerProduction: boolean;
			FeedConfigMaxPowerProduction: boolean;
			FeedConfigLastMeterProduction: boolean;
			FeedConfigPowerFactor: boolean;
			FeedConfigVoltagePhase1: boolean;
			FeedConfigVoltagePhase2: boolean;
			FeedConfigVoltagePhase3: boolean;
			FeedConfigCurrentL1: boolean;
			FeedConfigCurrentL2: boolean;
			FeedConfigCurrentL3: boolean;
			FeedConfigSignalStrength: boolean;
			UseCalculator: boolean;
			CalculatorList: [
				{
					chHomeID: string;
					chType: enCalcType;
					chName: string;
					chActive: boolean;
					chTargetState: string;
					chValueOn: string;
					chValueOff: string;
					chTriggerPrice: number;
					chAmountHours: number;
					chStartTime: Date;
					chStopTime: Date;
				},
			];
		}
	}
}

// this is required so the above AdapterConfig is found by TypeScript / type checking
export {};
