import "server-only";

import { headers } from "next/headers";
import { isNativeAppRequest } from "@/lib/native/platform";

export async function getIsNativeApp(): Promise<boolean> {
  return isNativeAppRequest(await headers());
}
