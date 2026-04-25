"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ActionButton, SurfaceCard } from "@sexxymarket/ui";
import { getMerchantToken } from "../../lib/merchant-auth";
import { useMerchantToast } from "../../components/merchant-toast-context";

const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000").replace(/\/$/, "");
const NIGERIA_GEO_DATA_URL =
  "https://gist.githubusercontent.com/devhammed/0bb9eeac9ff22c895100d072f489dc98/raw";
type StateLgaRow = { state: string; lgas: string[] };

const DOCS_INDIVIDUAL = ["id_front", "proof_of_address", "business_proof_of_address"] as const;
const DOCS_REGISTERED = [...DOCS_INDIVIDUAL, "cac_certificate", "cac_status_report"] as const;
const VERIFY_DRAFT_KEY = "merchant.verify.draft.v3";
const TOTAL_STEPS = 4;

type DocUploadState = {
  documentType: string;
  fileKey: string;
  fileUrl: string;
  fileName?: string;
  status: "idle" | "uploading" | "uploaded" | "error";
  error?: string;
};

type VerificationRecord = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  firstName?: string | null;
  lastName?: string | null;
  gender?: "MALE" | "FEMALE" | "OTHER" | null;
  dateOfBirth?: string | null;
  idNumber?: string | null;
  residentialAddress?: string | null;
  businessName?: string | null;
  isPhysicalStore?: boolean | null;
  physicalStoreAddress?: string | null;
  identityType?: "NIN" | "PASSPORT" | "DRIVERS_LICENSE" | "VOTERS_CARD" | null;
  businessAddress?: string | null;
  cacNumber?: string | null;
  tinNumber?: string | null;
  documents?: Array<{ documentType: string; fileKey: string; fileUrl: string }>;
};

function parseAddress(value?: string | null) {
  const text = String(value ?? "").trim();
  if (!text) return { houseNo: "", street: "", city: "", lga: "", state: "", landmark: "" };
  const parts = text.split(",").map((x) => x.trim()).filter(Boolean);
  const [houseNo = "", ...streetParts] = (parts[0] ?? "").split(" ");
  const street = streetParts.join(" ").trim();
  const city = parts[1] ?? "";
  const lga = parts[2] ?? "";
  const state = parts[3] ?? "";
  const landmark = (parts.find((p) => /^landmark:/i.test(p)) ?? "").replace(/^landmark:\s*/i, "");
  return { houseNo, street, city, lga, state, landmark };
}

function getFriendlyNetworkError(error: unknown, fallback: string) {
  if (error instanceof TypeError) {
    return "Cannot reach the server right now. Confirm the API is running on port 4000, then retry.";
  }
  if (error instanceof Error && /failed to fetch|networkerror|network request failed/i.test(error.message)) {
    return "Network connection to the API failed. Please check your API service and internet connection.";
  }
  return error instanceof Error ? error.message : fallback;
}

const DOC_LABELS: Record<string, string> = {
  id_front: "Government-issued ID",
  proof_of_address: "Proof of home address",
  business_proof_of_address: "Proof of business address",
  cac_certificate: "CAC certificate",
  cac_status_report: "CAC status report",
};
const DOC_HELP: Record<string, string> = {
  id_front: "Upload a clear government-issued identity document.",
  proof_of_address: "Utility bill, bank statement, or tenancy document showing your residential address.",
  business_proof_of_address: "Utility bill or lease agreement for business location.",
  cac_certificate: "Official CAC incorporation or registration certificate.",
  cac_status_report: "Current CAC status report extract.",
};

function getAgeFromDob(dateOfBirth: string) {
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthGap = now.getMonth() - dob.getMonth();
  if (monthGap < 0 || (monthGap === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age;
}

export default function VerifyPage() {
  const router = useRouter();
  const { push } = useMerchantToast();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState<"MALE" | "FEMALE" | "OTHER">("MALE");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [businessType, setBusinessType] = useState<"INDIVIDUAL" | "REGISTERED_BUSINESS">("INDIVIDUAL");
  const [identityType, setIdentityType] = useState<"NIN" | "PASSPORT" | "DRIVERS_LICENSE" | "VOTERS_CARD">("NIN");
  const [residenceHouseNo, setResidenceHouseNo] = useState("");
  const [residenceStreet, setResidenceStreet] = useState("");
  const [residenceCity, setResidenceCity] = useState("");
  const [residenceState, setResidenceState] = useState("");
  const [residenceLga, setResidenceLga] = useState("");
  const [residenceLandmark, setResidenceLandmark] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessHouseNo, setBusinessHouseNo] = useState("");
  const [businessStreet, setBusinessStreet] = useState("");
  const [businessCity, setBusinessCity] = useState("");
  const [businessState, setBusinessState] = useState("");
  const [businessLga, setBusinessLga] = useState("");
  const [businessLandmark, setBusinessLandmark] = useState("");
  const [hasPhysicalStore, setHasPhysicalStore] = useState(false);
  const [storeHouseNo, setStoreHouseNo] = useState("");
  const [storeStreet, setStoreStreet] = useState("");
  const [storeCity, setStoreCity] = useState("");
  const [storeState, setStoreState] = useState("");
  const [storeLga, setStoreLga] = useState("");
  const [storeLandmark, setStoreLandmark] = useState("");
  const [stateLgaRows, setStateLgaRows] = useState<StateLgaRow[]>([]);
  const [cacNumber, setCacNumber] = useState("");
  const [tinNumber, setTinNumber] = useState("");
  const [isRegisteredBusinessUpgrade, setIsRegisteredBusinessUpgrade] = useState(false);
  const [docs, setDocs] = useState<DocUploadState[]>(
    () =>
      [...DOCS_INDIVIDUAL].map((documentType) => ({
        documentType,
        fileKey: "",
        fileUrl: "",
        status: "idle",
      })),
  );
  const [profileExists, setProfileExists] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [hasExistingSubmission, setHasExistingSubmission] = useState(false);
  const [baselineSignature, setBaselineSignature] = useState("");
  const [previewEditStep, setPreviewEditStep] = useState<number | null>(null);

  useEffect(() => {
    const t = getMerchantToken();
    if (!t) return;
    void fetch(`${apiBase}/api/merchant/profile`, { headers: { Authorization: `Bearer ${t}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((p: { businessType?: "INDIVIDUAL" | "REGISTERED_BUSINESS"; user?: { firstName?: string; lastName?: string }; verifications?: VerificationRecord[] } | null) => {
        setProfileExists(!!p);
        if (!p?.businessType) return;
        setBusinessType(p.businessType);
        if (p.businessType === "REGISTERED_BUSINESS") {
          setIsRegisteredBusinessUpgrade(false);
        }
        setFirstName(p.user?.firstName ?? "");
        setLastName(p.user?.lastName ?? "");
        const list = p.businessType === "REGISTERED_BUSINESS" ? DOCS_REGISTERED : DOCS_INDIVIDUAL;
        setDocs(
          list.map((documentType) => ({
            documentType,
            fileKey: "",
            fileUrl: "",
            status: "idle",
          })),
        );
        const pending = p.verifications?.find((v) => v.status === "PENDING");
        if (pending) {
          setHasExistingSubmission(true);
          setStep(TOTAL_STEPS);
          setFirstName(pending.firstName ?? p.user?.firstName ?? "");
          setLastName(pending.lastName ?? p.user?.lastName ?? "");
          if (pending.gender) setGender(pending.gender);
          if (pending.dateOfBirth) setDateOfBirth(pending.dateOfBirth);
          if (pending.idNumber) setIdNumber(pending.idNumber);
          if (pending.identityType) setIdentityType(pending.identityType);
          if (pending.businessName) setBusinessName(pending.businessName);
          if (pending.isPhysicalStore != null) setHasPhysicalStore(!!pending.isPhysicalStore);
          if (pending.cacNumber) setCacNumber(pending.cacNumber);
          if (pending.tinNumber) setTinNumber(pending.tinNumber);

          const residential = parseAddress(pending.residentialAddress);
          setResidenceHouseNo(residential.houseNo);
          setResidenceStreet(residential.street);
          setResidenceCity(residential.city);
          setResidenceLga(residential.lga);
          setResidenceState(residential.state);
          setResidenceLandmark(residential.landmark);

          const business = parseAddress(pending.businessAddress);
          setBusinessHouseNo(business.houseNo);
          setBusinessStreet(business.street);
          setBusinessCity(business.city);
          setBusinessLga(business.lga);
          setBusinessState(business.state);
          setBusinessLandmark(business.landmark);

          const store = parseAddress(pending.physicalStoreAddress);
          setStoreHouseNo(store.houseNo);
          setStoreStreet(store.street);
          setStoreCity(store.city);
          setStoreLga(store.lga);
          setStoreState(store.state);
          setStoreLandmark(store.landmark);

          if (pending.documents?.length) {
            setDocs((prev) =>
              prev.map((doc) => {
                const found = pending.documents?.find((d) => d.documentType === doc.documentType);
                return found
                  ? { ...doc, fileKey: found.fileKey, fileUrl: found.fileUrl, status: "uploaded" }
                  : doc;
              }),
            );
          }
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(VERIFY_DRAFT_KEY);
    if (!raw) return;
    try {
      const draft = JSON.parse(raw) as {
        firstName?: string;
        lastName?: string;
        gender?: "MALE" | "FEMALE" | "OTHER";
        dateOfBirth?: string;
        idNumber?: string;
        businessType?: "INDIVIDUAL" | "REGISTERED_BUSINESS";
        identityType?: "NIN" | "PASSPORT" | "DRIVERS_LICENSE" | "VOTERS_CARD";
        residenceHouseNo?: string;
        residenceStreet?: string;
        residenceCity?: string;
        residenceState?: string;
        residenceLga?: string;
        residenceLandmark?: string;
        businessName?: string;
        businessHouseNo?: string;
        businessStreet?: string;
        businessCity?: string;
        businessState?: string;
        businessLga?: string;
        businessLandmark?: string;
        cacNumber?: string;
        tinNumber?: string;
        docs?: DocUploadState[];
      };
      if (typeof draft.firstName === "string") setFirstName(draft.firstName);
      if (typeof draft.lastName === "string") setLastName(draft.lastName);
      if (draft.gender) setGender(draft.gender);
      if (typeof draft.dateOfBirth === "string") setDateOfBirth(draft.dateOfBirth);
      if (typeof draft.idNumber === "string") setIdNumber(draft.idNumber);
      if (draft.businessType) setBusinessType(draft.businessType);
      if (draft.identityType) setIdentityType(draft.identityType);
      if (typeof draft.residenceHouseNo === "string") setResidenceHouseNo(draft.residenceHouseNo);
      if (typeof draft.residenceStreet === "string") setResidenceStreet(draft.residenceStreet);
      if (typeof draft.residenceCity === "string") setResidenceCity(draft.residenceCity);
      if (typeof draft.residenceState === "string") setResidenceState(draft.residenceState);
      if (typeof draft.residenceLga === "string") setResidenceLga(draft.residenceLga);
      if (typeof draft.residenceLandmark === "string") setResidenceLandmark(draft.residenceLandmark);
      if (typeof draft.businessName === "string") setBusinessName(draft.businessName);
      if (typeof draft.businessHouseNo === "string") setBusinessHouseNo(draft.businessHouseNo);
      if (typeof draft.businessStreet === "string") setBusinessStreet(draft.businessStreet);
      if (typeof draft.businessCity === "string") setBusinessCity(draft.businessCity);
      if (typeof draft.businessState === "string") setBusinessState(draft.businessState);
      if (typeof draft.businessLga === "string") setBusinessLga(draft.businessLga);
      if (typeof draft.businessLandmark === "string") setBusinessLandmark(draft.businessLandmark);
      if (typeof draft.cacNumber === "string") setCacNumber(draft.cacNumber);
      if (typeof draft.tinNumber === "string") setTinNumber(draft.tinNumber);
      if (Array.isArray(draft.docs) && draft.docs.length > 0) {
        setDocs(
          draft.docs.map((doc) => ({
            ...doc,
            status: doc.fileKey && doc.fileUrl ? "uploaded" : "idle",
          })),
        );
      }
    } catch {
      localStorage.removeItem(VERIFY_DRAFT_KEY);
    }
  }, []);

  const uploadDocumentFile = async (documentType: string, file: File) => {
    const t = getMerchantToken();
    if (!t) {
      push({ kind: "error", message: "Session missing. Sign in again." });
      return;
    }
    setDocs((prev) =>
      prev.map((doc) =>
        doc.documentType === documentType
          ? { ...doc, status: "uploading", error: undefined, fileName: file.name }
          : doc,
      ),
    );
    try {
      const formData = new FormData();
      formData.append("documentType", documentType);
      formData.append("file", file);
      const refRes = await fetch(`${apiBase}/api/merchant/documents/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${t}`,
        },
        body: formData,
      });
      if (!refRes.ok) {
        const body = (await refRes.json().catch(() => ({}))) as { message?: string | string[] };
        const msg = Array.isArray(body.message) ? body.message[0] : body.message;
        throw new Error(typeof msg === "string" ? msg : "Could not upload document");
      }
      const ref = (await refRes.json()) as { key: string; url: string };
      setDocs((prev) =>
        prev.map((doc) =>
          doc.documentType === documentType
            ? {
                ...doc,
                fileKey: ref.key,
                fileUrl: ref.url,
                fileName: file.name,
                status: "uploaded",
                error: undefined,
              }
            : doc,
        ),
      );
      push({ kind: "success", message: `${DOC_LABELS[documentType] ?? documentType} uploaded.` });
    } catch (error) {
      const message = getFriendlyNetworkError(error, "Upload failed");
      setDocs((prev) =>
        prev.map((doc) =>
          doc.documentType === documentType
            ? { ...doc, status: "error", error: message }
            : doc,
        ),
      );
      push({ kind: "error", message });
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(
      VERIFY_DRAFT_KEY,
      JSON.stringify({
        firstName,
        lastName,
        gender,
        dateOfBirth,
        idNumber,
        businessType,
        identityType,
        residenceHouseNo,
        residenceStreet,
        residenceCity,
        residenceState,
        residenceLga,
        residenceLandmark,
        businessName,
        businessHouseNo,
        businessStreet,
        businessCity,
        businessState,
        businessLga,
        businessLandmark,
        hasPhysicalStore,
        storeHouseNo,
        storeStreet,
        storeCity,
        storeState,
        storeLga,
        storeLandmark,
        cacNumber,
        tinNumber,
        docs,
      }),
    );
  }, [
    firstName,
    lastName,
    gender,
    dateOfBirth,
    idNumber,
    businessType,
    identityType,
    residenceHouseNo,
    residenceStreet,
    residenceCity,
    residenceState,
    residenceLga,
    residenceLandmark,
    businessName,
    businessHouseNo,
    businessStreet,
    businessCity,
    businessState,
    businessLga,
    businessLandmark,
    hasPhysicalStore,
    storeHouseNo,
    storeStreet,
    storeCity,
    storeState,
    storeLga,
    storeLandmark,
    cacNumber,
    tinNumber,
    docs,
  ]);

  useEffect(() => {
    void fetch(NIGERIA_GEO_DATA_URL)
      .then((r) => r.json())
      .then((rows) => {
        const normalized = Array.isArray(rows)
          ? rows
              .map((row) => ({
                state: String(row?.state ?? ""),
                lgas: Array.isArray(row?.lgas) ? row.lgas.map((lga: unknown) => String(lga)) : [],
              }))
              .filter((row) => row.state && row.lgas.length)
          : [];
        setStateLgaRows(normalized);
      })
      .catch(() => setStateLgaRows([]));
  }, []);

  const submit = async () => {
    const t = getMerchantToken();
    if (!t) {
      push({ kind: "error", message: "Session missing. Sign in again." });
      return;
    }
    const residentialAddress = [
      `${residenceHouseNo.trim()} ${residenceStreet.trim()}`.trim(),
      residenceCity.trim(),
      residenceLga.trim(),
      residenceState.trim(),
      residenceLandmark.trim() ? `Landmark: ${residenceLandmark.trim()}` : "",
    ]
      .filter(Boolean)
      .join(", ");
    const businessAddress = [
      `${businessHouseNo.trim()} ${businessStreet.trim()}`.trim(),
      businessCity.trim(),
      businessLga.trim(),
      businessState.trim(),
      businessLandmark.trim() ? `Landmark: ${businessLandmark.trim()}` : "",
    ]
      .filter(Boolean)
      .join(", ");
    const physicalStoreAddress = hasPhysicalStore
      ? [
          `${storeHouseNo.trim()} ${storeStreet.trim()}`.trim(),
          storeCity.trim(),
          storeLga.trim(),
          storeState.trim(),
          storeLandmark.trim() ? `Landmark: ${storeLandmark.trim()}` : "",
        ]
          .filter(Boolean)
          .join(", ")
      : "";
    const prepared = docs.filter((d) => d.fileKey.trim() && d.fileUrl.trim());
    if (prepared.length < docs.length) {
      push({ kind: "error", message: "Please upload every required document and provide both file key and file URL before submitting." });
      return;
    }
    setSubmitting(true);
    try {
      const applyRes = await fetch(`${apiBase}/api/merchant/apply`, {
        method: "POST",
        headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          // Keep profile in sync with the selected verification business type.
          businessName: businessName.trim(),
          businessType: isRegisteredBusinessUpgrade ? "INDIVIDUAL" : businessType,
          businessAddress: (hasPhysicalStore ? businessAddress : residentialAddress).trim(),
          hasPhysicalLocation: hasPhysicalStore,
          agreementAccepted: true,
        }),
      });
      if (!applyRes.ok) {
        const applyBody = (await applyRes.json().catch(() => ({}))) as { message?: string | string[] };
        const applyMsg = Array.isArray(applyBody.message) ? applyBody.message[0] : applyBody.message;
        throw new Error(typeof applyMsg === "string" ? applyMsg : "Unable to initialize merchant profile");
      }
      setProfileExists(true);
      const r = await fetch(`${apiBase}/api/merchant/verification`, {
        method: "POST",
        headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          gender,
          dateOfBirth,
          idNumber: idNumber.trim(),
          residentialAddress: residentialAddress.trim(),
          businessName: businessName.trim(),
          isPhysicalStore: hasPhysicalStore,
          physicalStoreAddress: hasPhysicalStore ? physicalStoreAddress : undefined,
          identityType,
          businessAddress: (hasPhysicalStore ? businessAddress : residentialAddress).trim(),
          cacNumber: cacNumber.trim() || undefined,
          tinNumber: tinNumber.trim() || undefined,
          isRegisteredBusinessUpgrade: isRegisteredBusinessUpgrade || undefined,
          documents: prepared.map((d) => ({
            documentType: d.documentType,
            fileKey: d.fileKey.trim(),
            fileUrl: d.fileUrl.trim(),
          })),
        }),
      });
      const body = (await r.json().catch(() => ({}))) as { message?: string | string[] };
      if (!r.ok) {
        const msg = Array.isArray(body.message) ? body.message[0] : body.message;
        throw new Error(typeof msg === "string" ? msg : "Submission failed");
      }
      push({ kind: "success", message: "Verification submitted. We will review your documents shortly." });
      localStorage.removeItem(VERIFY_DRAFT_KEY);
      setBaselineSignature(formSignature);
      setSubmitted(true);
    } catch (e) {
      push({ kind: "error", message: getFriendlyNetworkError(e, "Could not submit.") });
    } finally {
      setSubmitting(false);
    }
  };

  const validateStep = (currentStep: number) => {
    if (currentStep === 1) {
      if (
        !firstName.trim() ||
        !lastName.trim() ||
        !gender ||
        !dateOfBirth ||
        !idNumber.trim() ||
        !identityType ||
        !residenceHouseNo.trim() ||
        !residenceStreet.trim() ||
        !residenceCity.trim() ||
        !residenceState.trim() ||
        !residenceLga.trim()
      ) {
        push({ kind: "error", message: "Complete all required personal details before continuing." });
        return false;
      }
      if (getAgeFromDob(dateOfBirth) < 18) {
        push({ kind: "error", message: "Merchant must be 18 years or older to apply." });
        return false;
      }
      return true;
    }
    if (currentStep === 2) {
      if (
        !businessType ||
        !businessName.trim() ||
        (hasPhysicalStore && (!storeHouseNo.trim() || !storeStreet.trim() || !storeCity.trim() || !storeState.trim() || !storeLga.trim()))
      ) {
        push({ kind: "error", message: "Complete all required business details before continuing." });
        return false;
      }
      if (businessType === "REGISTERED_BUSINESS" || isRegisteredBusinessUpgrade) {
        if (!cacNumber.trim() || !tinNumber.trim()) {
          push({ kind: "error", message: "CAC number and TIN are required for registered (or upgrade) business details." });
          return false;
        }
      }
      return true;
    }
    if (currentStep === 3) {
      const prepared = docs.filter((d) => d.fileKey.trim() && d.fileUrl.trim());
      if (prepared.length < docs.length) {
        push({ kind: "error", message: "Upload all required documents before proceeding to final review." });
        return false;
      }
      return true;
    }
    return true;
  };

  const goNext = () => {
    if (!validateStep(step)) return;
    if (hasExistingSubmission && previewEditStep != null && step < TOTAL_STEPS) {
      setPreviewEditStep(null);
      setStep(TOTAL_STEPS);
      return;
    }
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  };

  const exitPreviewOrGoBack = () => {
    if (hasExistingSubmission && previewEditStep != null && step < TOTAL_STEPS) {
      setPreviewEditStep(null);
      setStep(TOTAL_STEPS);
      return;
    }
    if (step === TOTAL_STEPS && hasExistingSubmission) {
      router.push("/dashboard");
      return;
    }
    setStep((s) => Math.max(1, s - 1));
  };

  const editSectionFromPreview = (targetStep: number) => {
    setPreviewEditStep(targetStep);
    setStep(targetStep);
  };

  const formSignature = useMemo(
    () =>
      JSON.stringify({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        gender,
        dateOfBirth,
        idNumber: idNumber.trim(),
        businessType,
        identityType,
        residenceHouseNo: residenceHouseNo.trim(),
        residenceStreet: residenceStreet.trim(),
        residenceCity: residenceCity.trim(),
        residenceState: residenceState.trim(),
        residenceLga: residenceLga.trim(),
        residenceLandmark: residenceLandmark.trim(),
        businessName: businessName.trim(),
        businessHouseNo: businessHouseNo.trim(),
        businessStreet: businessStreet.trim(),
        businessCity: businessCity.trim(),
        businessState: businessState.trim(),
        businessLga: businessLga.trim(),
        businessLandmark: businessLandmark.trim(),
        hasPhysicalStore,
        storeHouseNo: storeHouseNo.trim(),
        storeStreet: storeStreet.trim(),
        storeCity: storeCity.trim(),
        storeState: storeState.trim(),
        storeLga: storeLga.trim(),
        storeLandmark: storeLandmark.trim(),
        cacNumber: cacNumber.trim(),
        tinNumber: tinNumber.trim(),
        docs: docs
          .map((d) => ({ documentType: d.documentType, fileKey: d.fileKey.trim(), fileUrl: d.fileUrl.trim() }))
          .sort((a, b) => a.documentType.localeCompare(b.documentType)),
      }),
    [
      firstName, lastName, gender, dateOfBirth, idNumber, businessType, identityType,
      residenceHouseNo, residenceStreet, residenceCity, residenceState, residenceLga, residenceLandmark,
      businessName, businessHouseNo, businessStreet, businessCity, businessState, businessLga, businessLandmark,
      hasPhysicalStore, storeHouseNo, storeStreet, storeCity, storeState, storeLga, storeLandmark,
      cacNumber, tinNumber, docs,
    ],
  );

  useEffect(() => {
    if (hasExistingSubmission && !baselineSignature && formSignature) {
      setBaselineSignature(formSignature);
    }
  }, [hasExistingSubmission, baselineSignature, formSignature]);

  const hasChanges = hasExistingSubmission ? baselineSignature !== "" && baselineSignature !== formSignature : true;

  if (submitted) {
    return (
      <main className="app-shell route-grid" style={{ maxWidth: 760, margin: "0 auto" }}>
        <SurfaceCard style={{ padding: "1.3rem" }}>
          <p className="route-eyebrow" style={{ margin: 0 }}>
            Merchant verification
          </p>
          <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
            <div className="chip" style={{ width: "fit-content" }}>
              Application submitted
            </div>
            <h1 className="section-title" style={{ margin: 0 }}>
              Awaiting compliance review
            </h1>
            <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>
              Your documents and business details were submitted successfully. Our team will review your application.
              Physical verification may be performed where required. Follow-up may happen through call, SMS, or email.
            </p>
            <div
              style={{
                border: "1px solid var(--ui-border)",
                borderRadius: 12,
                padding: "0.9rem",
                background: "color-mix(in oklab, var(--ui-surface) 88%, var(--ui-bg))",
              }}
            >
              <p style={{ margin: 0, fontWeight: 600 }}>Status timeline</p>
              <p className="muted" style={{ margin: "6px 0 0", fontSize: "0.88rem" }}>
                1. Application submitted (complete) · 2. Compliance review (in progress) · 3. Decision update (pending)
              </p>
            </div>
          </div>
          <div className="actions-row" style={{ marginTop: 14, justifyContent: "flex-end" }}>
            <Link href="/dashboard">
              <ActionButton>Return to dashboard</ActionButton>
            </Link>
          </div>
        </SurfaceCard>
      </main>
    );
  }

  return (
    <main className="app-shell route-grid" style={{ maxWidth: 780, margin: "0 auto", gap: 14 }}>
      <div className="actions-row" style={{ justifyContent: "space-between" }}>
        <h1 className="section-title" style={{ fontSize: "1.35rem", letterSpacing: "-0.01em" }}>Account verification (KYC)</h1>
        <Link href="/dashboard" className="chip" style={{ textDecoration: "none" }}>
          Dashboard
        </Link>
      </div>
      <SurfaceCard style={{ padding: "1.2rem", border: "1px solid var(--ui-border)" }}>
        <p className="muted" style={{ fontSize: "0.92rem", marginBottom: 12, lineHeight: 1.6 }}>
          Complete the guided steps. We auto-save your progress, and you can continue anytime.
        </p>
        <SurfaceCard
          style={{
            padding: "1rem",
            marginBottom: 14,
            border: "1px solid var(--ui-border)",
            background: "color-mix(in oklab, var(--ui-surface) 86%, var(--ui-bg))",
          }}
        >
          <p className="route-eyebrow" style={{ margin: 0 }}>
            Verification checklist
          </p>
          {businessType === "REGISTERED_BUSINESS" ? (
            <p className="muted" style={{ margin: "8px 0 0", fontSize: "0.88rem", lineHeight: 1.65 }}>
              For registered businesses: provide business details, CAC number, TIN, and upload ID, home address proof, business address proof, CAC certificate, and CAC status report.
            </p>
          ) : (
            <p className="muted" style={{ margin: "8px 0 0", fontSize: "0.88rem", lineHeight: 1.65 }}>
              For unregistered businesses: provide operating address and upload ID, home address proof, and business address proof.
            </p>
          )}
        </SurfaceCard>
        <div style={{ display: "grid", gap: 10, marginBottom: 16 }}>
          <div style={{ height: 8, borderRadius: 999, background: "var(--ui-border)" }}>
            <div
              style={{
                width: `${(step / TOTAL_STEPS) * 100}%`,
                height: "100%",
                borderRadius: 999,
                background: "var(--ui-accent)",
                transition: "width 220ms ease",
              }}
            />
          </div>
          <div className="actions-row" style={{ justifyContent: "space-between", gap: 12, fontSize: "0.84rem", color: "var(--ui-muted)" }}>
            <span>
              Step {step} of {TOTAL_STEPS} -{" "}
              {step === 1
                ? "Personal details"
                : step === 2
                  ? "Business details"
                  : step === 3
                    ? "Profile uploads"
                    : "Final review"}
            </span>
          </div>
        </div>

        {step === 1 ? (
          <SurfaceCard style={{ padding: "1rem", border: "1px solid var(--ui-border)" }}>
            <h2 style={{ margin: "0 0 10px", fontSize: "1.05rem" }}>Personal details</h2>
            <div className="merchant-auth-two-col">
            <div className="field">
              <label>First name *</label>
              <input className="text-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="As shown on your ID" />
            </div>
            <div className="field">
              <label>Last name *</label>
              <input className="text-input" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="As shown on your ID" />
            </div>
            <div className="field">
              <label>Gender *</label>
              <select className="text-input" value={gender} onChange={(e) => setGender(e.target.value as typeof gender)}>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div className="field">
              <label>Date of birth *</label>
              <input className="text-input" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
            </div>
            <div className="field">
              <label>ID type *</label>
              <select className="text-input" value={identityType} onChange={(e) => setIdentityType(e.target.value as typeof identityType)}>
                <option value="NIN">NIN</option>
                <option value="PASSPORT">Passport</option>
                <option value="DRIVERS_LICENSE">Driver&apos;s license</option>
                <option value="VOTERS_CARD">Voter&apos;s card</option>
              </select>
            </div>
            <div className="field">
              <label>ID number *</label>
              <input className="text-input" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />
            </div>
            <div className="field"><label>House no. *</label><input className="text-input" value={residenceHouseNo} onChange={(e) => setResidenceHouseNo(e.target.value)} /></div>
            <div className="field"><label>Street *</label><input className="text-input" value={residenceStreet} onChange={(e) => setResidenceStreet(e.target.value)} /></div>
            <div className="field"><label>City / town *</label><input className="text-input" value={residenceCity} onChange={(e) => setResidenceCity(e.target.value)} /></div>
            <div className="field">
              <label>State *</label>
              <select className="text-input" value={residenceState} onChange={(e) => { setResidenceState(e.target.value); setResidenceLga(""); }}>
                <option value="">Select state</option>
                {stateLgaRows.map((row) => <option key={row.state} value={row.state}>{row.state}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Local government *</label>
              <select className="text-input" value={residenceLga} onChange={(e) => setResidenceLga(e.target.value)}>
                <option value="">Select LGA</option>
                {(stateLgaRows.find((row) => row.state === residenceState)?.lgas ?? []).map((lga) => <option key={lga} value={lga}>{lga}</option>)}
              </select>
            </div>
            <div className="field"><label>Closest landmark (optional)</label><input className="text-input" value={residenceLandmark} onChange={(e) => setResidenceLandmark(e.target.value)} /></div>
            </div>
          </SurfaceCard>
        ) : null}

        {step === 2 ? (
          <SurfaceCard style={{ padding: "1rem", border: "1px solid var(--ui-border)" }}>
            <h2 style={{ margin: "0 0 10px", fontSize: "1.05rem" }}>Business details</h2>
            <div className="route-grid" style={{ gap: 12 }}>
            <div className="merchant-auth-two-col">
              <div className="field">
                <label>Business structure *</label>
              <select
                className="text-input"
                value={businessType}
                onChange={(e) => {
                  const next = e.target.value as "INDIVIDUAL" | "REGISTERED_BUSINESS";
                  setBusinessType(next);
                  if (next === "REGISTERED_BUSINESS") setIsRegisteredBusinessUpgrade(false);
                  const list =
                    next === "REGISTERED_BUSINESS" ? DOCS_REGISTERED : DOCS_INDIVIDUAL;
                  setDocs((prev) =>
                    list.map((documentType) => {
                      const found = prev.find((d) => d.documentType === documentType);
                      return found
                        ? { ...found, status: found.fileKey && found.fileUrl ? "uploaded" : "idle" }
                        : { documentType, fileKey: "", fileUrl: "", status: "idle" as const };
                    }),
                  );
                }}
              >
                <option value="INDIVIDUAL">Unregistered business</option>
                <option value="REGISTERED_BUSINESS">Registered business</option>
              </select>
            </div>
            <div className="field">
              <label>Business name *</label>
              <input className="text-input" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
            </div>
            </div>
            <label className="chip" style={{ width: "fit-content", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={hasPhysicalStore}
                onChange={(e) => setHasPhysicalStore(e.target.checked)}
                style={{ marginRight: 8 }}
              />
              I have a physical store location
            </label>
            {hasPhysicalStore ? (
              <div className="merchant-auth-two-col">
                <div className="field"><label>Business house no. *</label><input className="text-input" value={businessHouseNo} onChange={(e) => setBusinessHouseNo(e.target.value)} /></div>
                <div className="field"><label>Business street *</label><input className="text-input" value={businessStreet} onChange={(e) => setBusinessStreet(e.target.value)} /></div>
                <div className="field"><label>Business city / town *</label><input className="text-input" value={businessCity} onChange={(e) => setBusinessCity(e.target.value)} /></div>
                <div className="field">
                  <label>Business state *</label>
                  <select className="text-input" value={businessState} onChange={(e) => { setBusinessState(e.target.value); setBusinessLga(""); }}>
                    <option value="">Select state</option>
                    {stateLgaRows.map((row) => <option key={row.state} value={row.state}>{row.state}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Business local government *</label>
                  <select className="text-input" value={businessLga} onChange={(e) => setBusinessLga(e.target.value)}>
                    <option value="">Select LGA</option>
                    {(stateLgaRows.find((row) => row.state === businessState)?.lgas ?? []).map((lga) => <option key={lga} value={lga}>{lga}</option>)}
                  </select>
                </div>
                <div className="field"><label>Business landmark (optional)</label><input className="text-input" value={businessLandmark} onChange={(e) => setBusinessLandmark(e.target.value)} /></div>
                <div className="field"><label>Store house no. *</label><input className="text-input" value={storeHouseNo} onChange={(e) => setStoreHouseNo(e.target.value)} /></div>
                <div className="field"><label>Store street *</label><input className="text-input" value={storeStreet} onChange={(e) => setStoreStreet(e.target.value)} /></div>
                <div className="field"><label>Store city / town *</label><input className="text-input" value={storeCity} onChange={(e) => setStoreCity(e.target.value)} /></div>
                <div className="field">
                  <label>Store state *</label>
                  <select className="text-input" value={storeState} onChange={(e) => { setStoreState(e.target.value); setStoreLga(""); }}>
                    <option value="">Select state</option>
                    {stateLgaRows.map((row) => <option key={row.state} value={row.state}>{row.state}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Store local government *</label>
                  <select className="text-input" value={storeLga} onChange={(e) => setStoreLga(e.target.value)}>
                    <option value="">Select LGA</option>
                    {(stateLgaRows.find((row) => row.state === storeState)?.lgas ?? []).map((lga) => <option key={lga} value={lga}>{lga}</option>)}
                  </select>
                </div>
                <div className="field"><label>Store landmark (optional)</label><input className="text-input" value={storeLandmark} onChange={(e) => setStoreLandmark(e.target.value)} /></div>
              </div>
            ) : null}
            {businessType === "INDIVIDUAL" ? (
              <label className="chip" style={{ display: "flex", width: "fit-content", maxWidth: "100%", flexWrap: "wrap", alignItems: "center", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={isRegisteredBusinessUpgrade}
                  onChange={(e) => {
                    setIsRegisteredBusinessUpgrade(e.target.checked);
                    if (e.target.checked) {
                      setDocs((prev) =>
                        DOCS_REGISTERED.map((documentType) => {
                          const found = prev.find((d) => d.documentType === documentType);
                          return found
                            ? { ...found, status: found.fileKey && found.fileUrl ? "uploaded" : "idle" }
                            : { documentType, fileKey: "", fileUrl: "", status: "idle" as const };
                        }),
                      );
                    } else {
                      setDocs((prev) =>
                        DOCS_INDIVIDUAL.map((documentType) => {
                          const found = prev.find((d) => d.documentType === documentType);
                          return found
                            ? { ...found, status: found.fileKey && found.fileUrl ? "uploaded" : "idle" }
                            : { documentType, fileKey: "", fileUrl: "", status: "idle" as const };
                        }),
                      );
                    }
                  }}
                  style={{ marginRight: 8 }}
                />
                Request upgrade to <strong>registered business</strong> (submit CAC &amp; TIN; profile stays unregistered until an admin approves)
              </label>
            ) : null}
            {businessType === "REGISTERED_BUSINESS" || isRegisteredBusinessUpgrade ? (
              <div className="merchant-auth-two-col">
                <div className="field"><label>CAC number *</label><input className="text-input" value={cacNumber} onChange={(e) => setCacNumber(e.target.value)} /></div>
                <div className="field"><label>TIN *</label><input className="text-input" value={tinNumber} onChange={(e) => setTinNumber(e.target.value)} /></div>
              </div>
            ) : null}
            </div>
          </SurfaceCard>
        ) : null}

        {step === 3 ? (
          <SurfaceCard style={{ padding: "1rem", border: "1px solid var(--ui-border)" }}>
            <h2 style={{ margin: "0 0 10px", fontSize: "1.05rem" }}>Profile uploads</h2>
            <div className="route-grid" style={{ gap: 10 }}>
            {docs.map((doc) => (
              <SurfaceCard
                key={doc.documentType}
                style={{
                  padding: "1rem",
                  border: "1px solid var(--ui-border)",
                  background:
                    doc.status === "uploaded"
                      ? "linear-gradient(180deg, color-mix(in oklab, var(--ui-accent) 8%, var(--ui-surface)), var(--ui-surface))"
                      : "var(--ui-surface)",
                }}
              >
                <div className="actions-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong>{DOC_LABELS[doc.documentType] ?? doc.documentType}</strong>
                    <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.82rem" }}>
                      {doc.fileName ?? "Upload JPG, PNG, or PDF"}
                    </p>
                    <p className="muted" style={{ margin: "6px 0 0", fontSize: "0.8rem" }}>
                      {DOC_HELP[doc.documentType] ?? "Provide a clear and readable file."}
                    </p>
                  </div>
                  <span
                    className="chip"
                    style={{
                      borderColor:
                        doc.status === "uploaded"
                          ? "color-mix(in oklab, var(--ui-accent) 40%, var(--ui-border))"
                          : doc.status === "error"
                            ? "var(--ui-danger)"
                            : "var(--ui-border)",
                      color: doc.status === "error" ? "var(--ui-danger)" : undefined,
                    }}
                  >
                    {doc.status === "uploaded" ? "Uploaded" : doc.status === "uploading" ? "Uploading..." : doc.status === "error" ? "Retry needed" : "Pending"}
                  </span>
                </div>
                <div
                  style={{
                    marginTop: 12,
                    border: "1px dashed var(--ui-border)",
                    borderRadius: 12,
                    padding: "0.75rem",
                    background: "color-mix(in oklab, var(--ui-surface) 88%, var(--ui-bg))",
                  }}
                >
                  <div className="actions-row" style={{ gap: 8, justifyContent: "space-between" }}>
                    <label
                      className="chip"
                      style={{
                        cursor: "pointer",
                        padding: "0.52rem 0.82rem",
                        borderRadius: 999,
                        background: "color-mix(in oklab, var(--ui-accent) 18%, var(--ui-surface))",
                        borderColor: "color-mix(in oklab, var(--ui-accent) 35%, var(--ui-border))",
                      }}
                    >
                    <input
                      type="file"
                      accept=".png,.jpg,.jpeg,.pdf"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        void uploadDocumentFile(doc.documentType, file);
                      }}
                    />
                    {doc.status === "uploaded" ? "Replace file" : "Upload file"}
                  </label>
                    {doc.fileUrl ? (
                      <div className="actions-row" style={{ gap: 8 }}>
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="chip"
                          style={{ textDecoration: "none", padding: "0.52rem 0.82rem" }}
                        >
                          Open preview
                        </a>
                        <button
                          type="button"
                          className="chip"
                          onClick={() =>
                            setDocs((prev) =>
                              prev.map((row) =>
                                row.documentType === doc.documentType
                                  ? { ...row, fileKey: "", fileUrl: "", fileName: undefined, status: "idle", error: undefined }
                                  : row,
                              ),
                            )
                          }
                        >
                          Remove
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <p className="muted" style={{ margin: "8px 0 0", fontSize: "0.78rem" }}>
                    Use a clear file under 8MB. We accept PNG, JPG, and PDF.
                  </p>
                </div>
                {doc.error ? <p style={{ marginTop: 8, color: "var(--ui-danger)" }}>{doc.error}</p> : null}
              </SurfaceCard>
            ))}
            </div>
          </SurfaceCard>
        ) : null}

        {step === 4 ? (
          <SurfaceCard style={{ padding: "1rem", border: "1px solid var(--ui-border)" }}>
            <h2 style={{ margin: "0 0 10px", fontSize: "1.05rem" }}>Final review</h2>
            <div className="route-grid" style={{ gap: 10 }}>
            <SurfaceCard style={{ padding: "0.95rem" }}>
              <div className="actions-row" style={{ justifyContent: "space-between" }}>
                <strong>Personal details</strong>
                <ActionButton ghost onClick={() => editSectionFromPreview(1)}>Edit section</ActionButton>
              </div>
              <p className="muted" style={{ margin: "8px 0 0" }}>
                {firstName} {lastName} · {gender} · DOB: {dateOfBirth || "—"} · {identityType}: {idNumber || "—"}
              </p>
            </SurfaceCard>
            <SurfaceCard style={{ padding: "0.95rem" }}>
              <div className="actions-row" style={{ justifyContent: "space-between" }}>
                <strong>Business details</strong>
                <ActionButton ghost onClick={() => editSectionFromPreview(2)}>Edit section</ActionButton>
              </div>
              <p className="muted" style={{ margin: "8px 0 0" }}>
                {businessName || "—"} · {businessType === "REGISTERED_BUSINESS" ? "Registered business" : "Unregistered business"}
              </p>
            </SurfaceCard>
            <SurfaceCard style={{ padding: "0.95rem" }}>
              <div className="actions-row" style={{ justifyContent: "space-between" }}>
                <strong>Uploaded documents</strong>
                <ActionButton ghost onClick={() => editSectionFromPreview(3)}>Edit section</ActionButton>
              </div>
              <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                {docs.map((doc) => (
                  <div key={doc.documentType} className="actions-row" style={{ justifyContent: "space-between" }}>
                    <span>{DOC_LABELS[doc.documentType] ?? doc.documentType}</span>
                    <span className="chip">{doc.fileUrl ? "Uploaded" : "Missing"}</span>
                  </div>
                ))}
              </div>
            </SurfaceCard>
            </div>
          </SurfaceCard>
        ) : null}

        <div className="actions-row" style={{ marginTop: 16, justifyContent: "space-between" }}>
          <ActionButton
            ghost
            onClick={exitPreviewOrGoBack}
            disabled={submitting || (step === 1 && !(hasExistingSubmission && previewEditStep != null))}
          >
            {hasExistingSubmission && previewEditStep != null && step < TOTAL_STEPS
              ? "Back to preview"
              : step === TOTAL_STEPS && hasExistingSubmission
                ? "Exit preview"
                : "Back"}
          </ActionButton>
          {step < TOTAL_STEPS ? (
            <ActionButton onClick={goNext}>
              {hasExistingSubmission && previewEditStep != null ? "Continue to review" : "Continue"}
            </ActionButton>
          ) : (
            hasExistingSubmission && !hasChanges ? (
              <p className="muted" style={{ margin: 0, fontSize: "0.86rem" }}>
                No changes made yet.
              </p>
            ) : (
              <ActionButton isLoading={submitting} onClick={() => void submit()}>
                {hasExistingSubmission ? "Submit changes" : "Submit for review"}
              </ActionButton>
            )
          )}
        </div>
      </SurfaceCard>
    </main>
  );
}
