export type AssetLinkStatement = {
  relation: ["delegate_permission/common.handle_all_urls"];
  target: {
    namespace: "android_app";
    package_name: "app.kidda";
    sha256_cert_fingerprints: string[];
  };
};

/** Empty when ANDROID_CERT_SHA256 is unset, so the well-known file never 500s. */
export function assetLinks(raw: string | undefined | null): AssetLinkStatement[] {
  const fingerprints = (raw ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return fingerprints.map((sha256) => ({
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: "app.kidda",
      sha256_cert_fingerprints: [sha256],
    },
  }));
}
