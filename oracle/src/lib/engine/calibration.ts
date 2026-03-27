import { getCalibrationData } from "@/lib/db/queries";
import type { CalibrationStats } from "@/types";

export function computeCalibration(): CalibrationStats {
  return getCalibrationData();
}
