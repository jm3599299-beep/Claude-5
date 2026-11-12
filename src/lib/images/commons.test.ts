import { test } from "node:test";
import assert from "node:assert/strict";
import { CommonsLicenseError, entryFromCommons, plainText, rightsFromLicense } from "./commons.ts";

const base = {
  url: "https://upload.wikimedia.org/wikipedia/commons/x/xx/Example.jpg",
  descriptionurl: "https://commons.wikimedia.org/wiki/File:Example.jpg",
  mime: "image/jpeg",
  width: 4000,
  height: 3000,
  size: 2_000_000,
};

test("maps Commons license names to rights basis", () => {
  assert.equal(rightsFromLicense("CC BY-SA 4.0"), "cc-by-sa");
  assert.equal(rightsFromLicense("CC BY 2.0"), "cc-by");
  assert.equal(rightsFromLicense("CC0"), "cc0");
  assert.equal(rightsFromLicense("Public domain"), "cc0");
  assert.throws(() => rightsFromLicense("CC BY-NC 4.0"), CommonsLicenseError);
  assert.throws(() => rightsFromLicense("CC BY-ND 4.0"), CommonsLicenseError);
  assert.throws(() => rightsFromLicense("Fair use"), CommonsLicenseError);
});

test("strips HTML from author metadata", () => {
  assert.equal(plainText('<a href="//commons.wikimedia.org/wiki/User:Foo">Foo &amp; Bar</a>'), "Foo & Bar");
});

test("builds an attributed entry", () => {
  const e = entryFromCommons({
    ...base,
    extmetadata: {
      LicenseShortName: { value: "CC BY-SA 4.0" },
      LicenseUrl: { value: "https://creativecommons.org/licenses/by-sa/4.0" },
      Artist: { value: '<a href="/wiki/User:Foo">Foo</a>' },
    },
  });
  assert.equal(e.rights_basis, "cc-by-sa");
  assert.equal(e.author, "Foo");
  assert.equal(e.credit, "Foo / Wikimedia Commons");
});

test("rejects attribution licenses without author", () => {
  assert.throws(
    () => entryFromCommons({ ...base, extmetadata: { LicenseShortName: { value: "CC BY 4.0" }, LicenseUrl: { value: "https://x" } } }),
    CommonsLicenseError,
  );
});

test("rejects missing license and unsupported formats", () => {
  assert.throws(() => entryFromCommons({ ...base, extmetadata: {} }), CommonsLicenseError);
  assert.throws(() => entryFromCommons({ ...base, mime: "image/svg+xml", extmetadata: { LicenseShortName: { value: "CC0" } } }), CommonsLicenseError);
});
