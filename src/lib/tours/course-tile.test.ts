import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveLearnTourTileId, shouldOfferCourseResourceTour } from "./course-tile";

const KIDS_BEGINNERS = {
  id: "9db3685b-15fe-41a3-b902-1c2db3000b33",
  name: "Kids Beginners Course (Level 1)",
  required_tier: "private",
  is_public: true,
  content_track: "kids",
};

describe("shouldOfferCourseResourceTour", () => {
  it("does not queue a tour for a kids-track course", () => {
    assert.equal(shouldOfferCourseResourceTour(KIDS_BEGINNERS), false);
  });

  it("still resolves a private course to the english tile when a tour is offered", () => {
    assert.equal(resolveLearnTourTileId(KIDS_BEGINNERS), "english");
  });

  it("queues a public beginners course", () => {
    assert.equal(
      shouldOfferCourseResourceTour({
        content_track: null,
        is_home_course: null,
      }),
      true
    );
  });
});
