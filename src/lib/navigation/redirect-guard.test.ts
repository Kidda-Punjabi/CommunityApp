import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planRedirect } from "./redirect-guard";

describe("planRedirect", () => {
  it("does not redirect onto the route already open", () => {
    assert.equal(
      planRedirect({
        currentPath: "/dashboard/learn",
        destination: "/dashboard/learn",
        redirectsAlreadyIssued: 0,
      }),
      null
    );
    assert.equal(
      planRedirect({
        currentPath: "/dashboard/learn/",
        destination: "/dashboard/learn",
        redirectsAlreadyIssued: 0,
      }),
      null
    );
  });

  it("allows one redirect to a different route", () => {
    assert.equal(
      planRedirect({
        currentPath: "/dashboard/home",
        destination: "/dashboard/learn",
        redirectsAlreadyIssued: 0,
      }),
      "/dashboard/learn"
    );
  });

  it("refuses a second redirect in the same navigation", () => {
    assert.equal(
      planRedirect({
        currentPath: "/dashboard/kids",
        destination: "/dashboard/learn",
        redirectsAlreadyIssued: 1,
      }),
      null
    );
  });

  it("does not redirect when the current route is unknown", () => {
    assert.equal(
      planRedirect({
        currentPath: "",
        destination: "/dashboard/profile/kids",
        redirectsAlreadyIssued: 0,
      }),
      null
    );
  });
});
