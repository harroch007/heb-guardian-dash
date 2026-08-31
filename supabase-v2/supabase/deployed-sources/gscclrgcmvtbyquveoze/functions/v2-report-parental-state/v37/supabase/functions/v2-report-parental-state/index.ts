import { isUuid, requireDevice, serviceClient } from "../_shared/auth.ts";
import {
  handleError,
  HttpError,
  jsonResponse,
  readJsonObject,
} from "../_shared/http.ts";

function optionalNumber(
  value: unknown,
  minimum: number,
  maximum: number,
  code: string,
): number | null {
  if (value === null || value === undefined) return null;
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new HttpError(400, code);
  }
  return value;
}

function optionalString(
  value: unknown,
  maximum: number,
  code: string,
): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || value.length > maximum) {
    throw new HttpError(400, code);
  }
  return value;
}

function optionalIsoInstant(value: unknown, code: string): string | null {
  if (value === null || value === undefined) return null;
  if (
    typeof value !== "string" ||
    !Number.isFinite(Date.parse(value))
  ) {
    throw new HttpError(400, code);
  }
  return value;
}

function boundedArray(
  value: unknown,
  maximum: number,
  code: string,
): unknown[] {
  if (!Array.isArray(value) || value.length > maximum) {
    throw new HttpError(400, code);
  }
  return value;
}

Deno.serve(async (request) => {
  try {
    const body = await readJsonObject(request, 128 * 1024);
    if (!isUuid(body.event_key)) {
      throw new HttpError(400, "invalid_parental_event_key");
    }
    const revision = optionalNumber(
      body.settings_revision_applied,
      0,
      Number.MAX_SAFE_INTEGER,
      "invalid_settings_revision",
    );
    if (revision === null || !Number.isSafeInteger(revision)) {
      throw new HttpError(400, "invalid_settings_revision");
    }
    if (
      typeof body.observed_at !== "string" ||
      !Number.isFinite(Date.parse(body.observed_at))
    ) {
      throw new HttpError(400, "invalid_parental_observed_at");
    }

    const usageDate = optionalString(
      body.usage_date,
      10,
      "invalid_usage_date",
    );
    if (usageDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(usageDate)) {
      throw new HttpError(400, "invalid_usage_date");
    }

    const latitude = optionalNumber(
      body.latitude,
      -90,
      90,
      "invalid_location",
    );
    const longitude = optionalNumber(
      body.longitude,
      -180,
      180,
      "invalid_location",
    );
    if ((latitude === null) !== (longitude === null)) {
      throw new HttpError(400, "invalid_location");
    }

    const installedApps = boundedArray(
      body.installed_apps ?? [],
      500,
      "invalid_installed_apps",
    );
    const appUsage = boundedArray(
      body.app_usage ?? [],
      500,
      "invalid_app_usage",
    );
    const blockedAttempts = boundedArray(
      body.blocked_attempts ?? [],
      100,
      "invalid_blocked_attempts",
    );
    const geofenceEvents = boundedArray(
      body.geofence_events ?? [],
      100,
      "invalid_geofence_events",
    );
    for (const value of geofenceEvents) {
      if (value === null || typeof value !== "object") {
        throw new HttpError(400, "invalid_geofence_event");
      }
      const event = value as Record<string, unknown>;
      const eventLatitude = optionalNumber(
        event.latitude,
        -90,
        90,
        "invalid_geofence_event",
      );
      const eventLongitude = optionalNumber(
        event.longitude,
        -180,
        180,
        "invalid_geofence_event",
      );
      if (
        !isUuid(event.event_key) ||
        !isUuid(event.geofence_id) ||
        (event.transition !== "enter" && event.transition !== "exit") ||
        typeof event.occurred_at !== "string" ||
        !Number.isFinite(Date.parse(event.occurred_at)) ||
        (eventLatitude === null) !== (eventLongitude === null)
      ) {
        throw new HttpError(400, "invalid_geofence_event");
      }
      optionalNumber(
        event.location_accuracy_meters,
        0,
        100000,
        "invalid_geofence_event",
      );
    }

    const client = serviceClient();
    const device = await requireDevice(request, client);
    const { data, error } = await client.rpc(
      "v2_report_parental_state_service",
      {
        target_device_id: device.deviceId,
        target_event_key: body.event_key,
        target_settings_revision: revision,
        target_usage_date: usageDate,
        target_total_screen_minutes: optionalNumber(
          body.total_screen_minutes,
          0,
          1440,
          "invalid_total_screen_minutes",
        ),
        target_latitude: latitude,
        target_longitude: longitude,
        target_location_accuracy_meters: optionalNumber(
          body.location_accuracy_meters,
          0,
          100000,
          "invalid_location_accuracy",
        ),
        target_location_address: optionalString(
          body.location_address,
          240,
          "invalid_location_address",
        ),
        target_location_observed_at: optionalIsoInstant(
          body.location_observed_at,
          "invalid_location_observed_at",
        ),
        target_observed_at: body.observed_at,
        target_installed_apps: installedApps,
        target_app_usage: appUsage,
        target_blocked_attempts: blockedAttempts,
      },
    );
    if (error) throw error;
    const result = Array.isArray(data) ? data[0] : data;
    if (geofenceEvents.length > 0) {
      const { error: geofenceError } = await client.rpc(
        "v2_report_geofence_events_service",
        {
          target_device_id: device.deviceId,
          target_events: geofenceEvents,
        },
      );
      if (geofenceError) throw geofenceError;
    }

    return jsonResponse(200, {
      accepted: result?.accepted === true,
      affects_current_state: result?.affects_current_state === true,
    });
  } catch (error) {
    return handleError(error);
  }
});
