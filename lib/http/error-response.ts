import { NextResponse } from "next/server";

import type { ServiceError, ServiceErrorCode } from "./service-result";

const STATUS_BY_CODE: Record<ServiceErrorCode, number> = {
  "invalid-input": 400,
  "not-found": 404,
  conflict: 409,
  "too-large": 413,
  "upstream-error": 502,
  "rate-limited": 429,
};

/** Maps a learning-content service failure to the equivalent HTTP response. */
export function serviceErrorResponse(error: ServiceError): NextResponse {
  return NextResponse.json(
    { error: error.message },
    { status: STATUS_BY_CODE[error.code] },
  );
}
