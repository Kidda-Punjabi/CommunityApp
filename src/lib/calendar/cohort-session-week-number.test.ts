import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cohortAnchorTitlesByCohort,
  isCohortClassSession,
} from "./cohort-session-week-number";

const circle = {
  cohort_id: "circle-2",
  title: "Kidda - Circle 2 (7-9)",
  status: "scheduled",
  match_method: "manual",
};

describe("isCohortClassSession", () => {
  const anchors = cohortAnchorTitlesByCohort([
    circle,
    {
      cohort_id: "circle-2",
      title: "Kidda Class - Cohort 24",
      status: "scheduled",
      match_method: "title_name",
    },
    {
      cohort_id: "circle-2",
      title: "Cancelled class",
      status: "cancelled",
      match_method: "manual",
    },
    {
      cohort_id: "circle-2",
      title: "Kidda Team Meeting",
      status: "scheduled",
      match_method: "manual",
    },
  ]);

  it("keeps a class title and a manual anchor title, and drops meetings and title_name rows", () => {
    const anchorTitles = anchors.get("circle-2");
    assert.equal(
      isCohortClassSession(
        {
          cohort_id: "circle-2",
          title: "Kidda Class - Cohort 44",
          status: "scheduled",
          match_method: "attendee_email",
        },
        anchorTitles
      ),
      true
    );
    assert.equal(isCohortClassSession(circle, anchorTitles), true);
    assert.equal(
      isCohortClassSession(
        {
          cohort_id: "circle-2",
          title: "Kidda - Circle 2 (7-9)",
          status: "scheduled",
          match_method: "attendee_email",
        },
        anchorTitles
      ),
      true
    );
    assert.equal(
      isCohortClassSession(
        {
          cohort_id: "circle-2",
          title: "Kidda Class - Cohort 24",
          status: "scheduled",
          match_method: "title_name",
        },
        anchorTitles
      ),
      false
    );
    assert.equal(
      isCohortClassSession(
        {
          cohort_id: "circle-2",
          title: "EOD Debrief",
          status: "scheduled",
          match_method: "attendee_email",
        },
        anchorTitles
      ),
      false
    );
    assert.equal(
      isCohortClassSession(
        {
          cohort_id: "circle-2",
          title: "Kidda Team Meeting",
          status: "scheduled",
          match_method: "manual",
        },
        anchorTitles
      ),
      false
    );
  });
});
