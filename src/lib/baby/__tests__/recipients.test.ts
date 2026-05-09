import { describe, it, expect } from "vitest";
import { computeReplyRecipients, plainToHtml } from "../recipients";

const AGENT = "daily-baby@noahhshaw.com";
const NOAH = "noahhshaw@gmail.com";
const ANUSHKA = "vaswani.anoushka@gmail.com";
const ALLOW = [NOAH, ANUSHKA];
const OPTS = {
  agentAddress: AGENT,
  parentAllowList: ALLOW,
  agentDomain: "noahhshaw.com",
};

describe("computeReplyRecipients", () => {
  it("when one parent emails just the agent, replies only to that parent", () => {
    const got = computeReplyRecipients(
      [{ fromEmail: ANUSHKA, toEmails: [AGENT], ccEmails: [] }],
      OPTS
    );
    expect(got).toEqual([ANUSHKA]);
  });

  it("when a parent replies-all (cc'ing the other parent), replies to both", () => {
    const got = computeReplyRecipients(
      [{ fromEmail: ANUSHKA, toEmails: [AGENT, NOAH], ccEmails: [] }],
      OPTS
    );
    expect(got.sort()).toEqual([ANUSHKA, NOAH].sort());
  });

  it("Cc field is included in recipients", () => {
    const got = computeReplyRecipients(
      [{ fromEmail: NOAH, toEmails: [AGENT], ccEmails: [ANUSHKA] }],
      OPTS
    );
    expect(got.sort()).toEqual([NOAH, ANUSHKA].sort());
  });

  it("the agent address is always stripped, regardless of capitalization", () => {
    const got = computeReplyRecipients(
      [{ fromEmail: NOAH, toEmails: ["Daily-Baby@noahhshaw.com"], ccEmails: [] }],
      OPTS
    );
    expect(got).toEqual([NOAH]);
    expect(got).not.toContain(AGENT);
  });

  it("normalizes mixed-case emails", () => {
    const got = computeReplyRecipients(
      [
        {
          fromEmail: "ANUSHKA@gmail.com",
          toEmails: [AGENT, "Noah@Gmail.com"],
          ccEmails: [],
        },
      ],
      { ...OPTS, parentAllowList: ["anushka@gmail.com", "noah@gmail.com"] }
    );
    expect(got.sort()).toEqual(["anushka@gmail.com", "noah@gmail.com"].sort());
  });

  it("strips on-domain non-allowlisted aliases (defensive against bounce@)", () => {
    const got = computeReplyRecipients(
      [
        {
          fromEmail: NOAH,
          toEmails: [AGENT],
          ccEmails: ["bounce@noahhshaw.com", "no-reply@noahhshaw.com"],
        },
      ],
      OPTS
    );
    expect(got).toEqual([NOAH]);
  });

  it("preserves on-domain allowlisted parents (if a parent's email were on the agent domain)", () => {
    const got = computeReplyRecipients(
      [
        {
          fromEmail: "noah@noahhshaw.com",
          toEmails: [AGENT],
          ccEmails: [],
        },
      ],
      {
        ...OPTS,
        parentAllowList: ["noah@noahhshaw.com"],
      }
    );
    expect(got).toEqual(["noah@noahhshaw.com"]);
  });

  it("when multiple inbound replies are batched, takes the union", () => {
    const got = computeReplyRecipients(
      [
        { fromEmail: ANUSHKA, toEmails: [AGENT], ccEmails: [] },
        { fromEmail: ANUSHKA, toEmails: [AGENT, NOAH], ccEmails: [] },
      ],
      OPTS
    );
    expect(got.sort()).toEqual([ANUSHKA, NOAH].sort());
  });

  it("dedupes when an address appears in multiple slots", () => {
    const got = computeReplyRecipients(
      [
        {
          fromEmail: NOAH,
          toEmails: [AGENT, NOAH],
          ccEmails: [NOAH, AGENT],
        },
      ],
      OPTS
    );
    expect(got).toEqual([NOAH]);
  });

  it("returns an empty list if the only recipient was the agent itself", () => {
    const got = computeReplyRecipients(
      [{ fromEmail: AGENT, toEmails: [AGENT], ccEmails: [] }],
      OPTS
    );
    expect(got).toEqual([]);
  });

  it("uses default constants when no options are passed", () => {
    const got = computeReplyRecipients([
      { fromEmail: NOAH, toEmails: ["daily-baby@noahhshaw.com"], ccEmails: [] },
    ]);
    expect(got).toContain(NOAH);
    expect(got).not.toContain("daily-baby@noahhshaw.com");
  });
});

describe("plainToHtml", () => {
  it("escapes HTML metacharacters", () => {
    const html = plainToHtml("a < b & c > d");
    expect(html).toContain("a &lt; b &amp; c &gt; d");
  });

  it("preserves whitespace via white-space:pre-wrap", () => {
    const html = plainToHtml("line1\nline2");
    expect(html).toContain("white-space:pre-wrap");
    expect(html).toContain("line1\nline2");
  });
});
