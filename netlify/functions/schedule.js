import { getStore } from "@netlify/blobs";

const CONFIG_KEY = "config";
const MAX_WRITE_ATTEMPTS = 6;

function scheduleKey(date) {
  return `schedule-${date}`;
}

function emptySchedule() {
  return { AM: {}, PM: {} };
}

// Look up how many seats a workstation has (defaults to 1 if not found
// or not set, so older/malformed config data never breaks sign-in).
function getWorkstationCapacity(configData, workstationId) {
  for (const loc of configData.locations || []) {
    for (const ws of loc.workstations || []) {
      if (ws.id === workstationId) {
        const n = parseInt(ws.capacity, 10);
        return Number.isFinite(n) && n > 0 ? n : 1;
      }
    }
  }
  return 1;
}

export default async (req) => {
  const store = getStore("shift-board");
  const url = new URL(req.url);

  if (req.method === "GET") {
    const date = url.searchParams.get("date");
    if (!date) {
      return new Response("Missing 'date' query param (YYYY-MM-DD)", {
        status: 400
      });
    }
    // Strong consistency so a page reload always reflects the very latest
    // write, rather than a possibly-stale cached copy.
    const existing = await store.get(scheduleKey(date), {
      type: "json",
      consistency: "strong"
    });
    return Response.json(existing || emptySchedule());
  }

  if (req.method === "POST") {
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response("Invalid JSON body", { status: 400 });
    }

    const { date, shift, staffId, locationId, workstationId, replaceStaffId } = body;

    if (!date || !shift || !staffId) {
      return new Response("Missing required fields: date, shift, staffId", {
        status: 400
      });
    }
    if (shift !== "AM" && shift !== "PM") {
      return new Response("shift must be 'AM' or 'PM'", { status: 400 });
    }

    const key = scheduleKey(date);

    // Netlify Blobs has no built-in locking — concurrent writes to the same
    // key are last-write-wins. Since every sign-in/leave/take-over for the
    // whole practice on a given day shares one record, two people acting
    // within moments of each other can otherwise silently undo one another.
    // This loop uses conditional (ETag-based) writes to detect that case
    // and retries against fresh data instead of clobbering it.
    for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt++) {
      const entry = await store.getWithMetadata(key, {
        type: "json",
        consistency: "strong"
      });
      const current = (entry && entry.data) || emptySchedule();
      const etag = entry ? entry.etag : null;
      const shiftAssignments = current[shift];

      if (locationId === null || locationId === undefined) {
        // Clearing this person's assignment for the shift
        delete shiftAssignments[staffId];
      } else {
        if (workstationId) {
          // If this sign-in is explicitly taking over a specific person's
          // seat, clear that person's assignment first — but only if
          // they're actually still the one sitting in that seat (avoids
          // clobbering someone who has since moved elsewhere).
          if (
            replaceStaffId &&
            shiftAssignments[replaceStaffId] &&
            shiftAssignments[replaceStaffId].workstationId === workstationId
          ) {
            delete shiftAssignments[replaceStaffId];
          }

          // Capacity check: count how many *other* staff currently occupy
          // this workstation before allowing the new sign-in.
          const configData = (await store.get(CONFIG_KEY, {
            type: "json",
            consistency: "strong"
          })) || { locations: [] };
          const capacity = getWorkstationCapacity(configData, workstationId);
          const otherOccupants = Object.entries(shiftAssignments).filter(
            ([sid, a]) => sid !== staffId && a.workstationId === workstationId
          ).length;

          if (otherOccupants >= capacity) {
            return new Response("Workstation is full", { status: 409 });
          }
        }

        shiftAssignments[staffId] = {
          locationId,
          workstationId: workstationId || null
        };
      }

      const writeResult = await store.setJSON(
        key,
        current,
        etag ? { onlyIfMatch: etag } : { onlyIfNew: true }
      );

      if (writeResult && writeResult.modified !== false) {
        return Response.json(current);
      }
      // Someone else wrote to this date's schedule between our read and
      // write — loop back and retry against the now-current data.
    }

    return new Response(
      "Board is busy right now — please try again.",
      { status: 503 }
    );
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config = {
  path: "/api/schedule"
};
