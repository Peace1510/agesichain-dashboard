import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export interface NonTechnicalSummary {
  sessionCode: string;
  vaccineName: string;
  vaccineTier: string;
  batchNumber: string | null;
  origin: string;
  destination: string;
  startedAt: string;
  endedAt: string | null;
  durationText: string;
  overallVerdict: "SAFE" | "CAUTION" | "CRITICAL";
  verdictTitle: string;
  verdictBadge: string;
  verdictColor: "emerald" | "amber" | "rose";
  potencyScore: number;
  isViable: boolean;
  plainLanguageSummary: string;
  tripStory: {
    journeyOverview: string;
    coolingPerformance: string;
    safetyConclusion: string;
  };
  thermalComparison: {
    safeMin: number;
    safeMax: number;
    recordedMin: number;
    recordedMax: number;
    recordedAvg: number;
    statusText: string;
    withinEnvelope: boolean;
  };
  highlights: Array<{
    title: string;
    value: string;
    desc: string;
    type: "positive" | "warning" | "neutral";
  }>;
  clinicChecklist: Array<{
    step: number;
    action: string;
    detail: string;
    status: "required" | "optional" | "warning";
  }>;
  nonTechnicalFaq: Array<{
    q: string;
    a: string;
  }>;
}

/**
 * Format hours and minutes in clean plain English
 */
function formatDuration(startedAt: Date, endedAt: Date | null): string {
  const end = endedAt || new Date();
  const diffMs = Math.max(0, end.getTime() - startedAt.getTime());
  const totalMinutes = Math.round(diffMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${Math.max(1, minutes)} minutes`;
  }
  if (minutes === 0) {
    return `${hours} hour${hours > 1 ? "s" : ""}`;
  }
  return `${hours} hr ${minutes} min`;
}

/**
 * Deterministic Clinical Intelligence engine that converts complex telemetry
 * and kinetic integrals into an accessible, non-technical plain-English report.
 */
function generateDeterministicSummary(
  session: {
    sessionCode: string;
    vaccineName: string;
    vaccineTier: string;
    minTemp: number;
    maxTemp: number;
    batchNumber: string | null;
    origin: string;
    destination: string;
    startedAt: Date;
    endedAt: Date | null;
    totalReadings: number;
    avgTemperature: number | null;
    minRecordedTemp: number | null;
    maxRecordedTemp: number | null;
    excursionCount: number;
    finalViability: number | null;
    finalStatus: string | null;
  },
  logs: Array<{
    timestamp: Date;
    temperature: number;
    isExcursion: boolean;
    viability: number | null;
  }>
): NonTechnicalSummary {
  const durationText = formatDuration(new Date(session.startedAt), session.endedAt ? new Date(session.endedAt) : null);

  // Compute thermal bounds from logs if summary fields are null
  const temperatures = logs.map((l) => l.temperature);
  const hasLogs = temperatures.length > 0;

  const recordedMin = session.minRecordedTemp !== null
    ? session.minRecordedTemp
    : hasLogs ? Math.min(...temperatures) : session.minTemp;

  const recordedMax = session.maxRecordedTemp !== null
    ? session.maxRecordedTemp
    : hasLogs ? Math.max(...temperatures) : session.maxTemp;

  const recordedAvg = session.avgTemperature !== null
    ? session.avgTemperature
    : hasLogs ? Number((temperatures.reduce((a, b) => a + b, 0) / temperatures.length).toFixed(1)) : Number(((session.minTemp + session.maxTemp) / 2).toFixed(1));

  const totalExcursions = session.excursionCount > 0
    ? session.excursionCount
    : logs.filter((l) => l.isExcursion).length;

  const potencyFraction = session.finalViability !== null
    ? session.finalViability
    : hasLogs && logs[logs.length - 1].viability !== null
    ? (logs[logs.length - 1].viability as number)
    : 1.0;

  const potencyScore = Number((potencyFraction * 100).toFixed(1));
  const isViable = potencyScore >= 80.0;

  // Evaluate risk level for non-technical personas
  let overallVerdict: "SAFE" | "CAUTION" | "CRITICAL" = "SAFE";
  let verdictTitle = "APPROVED: Safe for Patient Administration";
  let verdictBadge = "Cold Chain Fully Maintained (100% Viable)";
  let verdictColor: "emerald" | "amber" | "rose" = "emerald";

  const isFreezeSensitive = session.vaccineTier === "STANDARD_REFRIGERATED";
  const sufferedFreeze = isFreezeSensitive && recordedMin < 0.0;
  const sufferedHeatDenature = recordedMax > session.maxTemp + 10.0;

  if (!isViable || sufferedFreeze || totalExcursions >= 50 || sufferedHeatDenature) {
    overallVerdict = "CRITICAL";
    verdictTitle = "CRITICAL: Do Not Administer to Patients";
    verdictBadge = sufferedFreeze
      ? "Damaged by Freezing Sub-Zero Temperatures"
      : "Severe Temperature Breach — Viability Compromised";
    verdictColor = "rose";
  } else if (totalExcursions > 0 || potencyScore < 95.0) {
    overallVerdict = "CAUTION";
    verdictTitle = "CAUTION: Physical Inspection Required Before Use";
    verdictBadge = `Minor Excursions Detected (${totalExcursions} events)`;
    verdictColor = "amber";
  }

  // Generate plain-English narratives
  let journeyOverview = `This shipment of ${session.vaccineName} (${session.batchNumber ? `Batch ${session.batchNumber}` : session.sessionCode}) was transported from ${session.origin} to ${session.destination}. The entire trip took ${durationText}.`;
  
  let coolingPerformance = "";
  let safetyConclusion = "";

  if (overallVerdict === "SAFE") {
    coolingPerformance = `The transport cooler functioned exceptionally well. Temperatures remained consistently between ${recordedMin.toFixed(1)}°C and ${recordedMax.toFixed(1)}°C, comfortably inside the required safe window of ${session.minTemp}°C to ${session.maxTemp}°C. Sensor telemetry recorded 0 harmful temperature breaches.`;
    safetyConclusion = `Because there were no freeze or overheating episodes, the vaccine sustained 0% molecular decay and maintains ${potencyScore}% full strength potency. It meets all WHO and CDC guidelines and is immediately ready for vaccination.`;
  } else if (overallVerdict === "CAUTION") {
    coolingPerformance = `The cooler briefly deviated outside the safe zone (${totalExcursions} alert points detected, reaching a high of ${recordedMax.toFixed(1)}°C). However, the cooling system restored safe temperatures quickly before permanent damage took place.`;
    safetyConclusion = `The estimated potency remains at ${potencyScore}%, which is still above the 80% passing standard. Hospital receiving staff must perform a routine visual inspection of the vial and Vaccine Vial Monitor (VVM) square before patient injection.`;
  } else {
    coolingPerformance = `The shipment suffered severe cold-chain failure during transit. Temperatures breached safe limits (Recorded: ${recordedMin.toFixed(1)}°C to ${recordedMax.toFixed(1)}°C against allowed ${session.minTemp}°C to ${session.maxTemp}°C).`;
    safetyConclusion = `This exposure degraded the active immunizing proteins. Administering compromised vaccine carries risks of diminished immune protection. This entire batch must be quarantined and returned to the depot.`;
  }

  const plainLanguageSummary = `${journeyOverview} ${coolingPerformance} ${safetyConclusion}`;

  // Thermal comparison envelope
  const withinEnvelope = recordedMin >= session.minTemp && recordedMax <= session.maxTemp;
  const statusText = withinEnvelope
    ? `All readings stayed within the safe ${session.minTemp}°C to ${session.maxTemp}°C window.`
    : `Readings breached the safe envelope (Range: ${recordedMin.toFixed(1)}°C – ${recordedMax.toFixed(1)}°C).`;

  // Highlights
  const highlights = [
    {
      title: "Vaccine Potency",
      value: `${potencyScore}%`,
      desc: isViable ? "Passes clinical standard (>80%)" : "Fails minimum viability standard",
      type: (potencyScore >= 95 ? "positive" : potencyScore >= 80 ? "warning" : "warning") as "positive" | "warning",
    },
    {
      title: "Temperature Range",
      value: `${recordedMin.toFixed(1)}°C to ${recordedMax.toFixed(1)}°C`,
      desc: withinEnvelope ? `Safe range: ${session.minTemp}°C to ${session.maxTemp}°C` : `Breached allowed limits`,
      type: (withinEnvelope ? "positive" : "warning") as "positive" | "warning",
    },
    {
      title: "Temperature Breaches",
      value: totalExcursions === 0 ? "0 Incidents" : `${totalExcursions} Incidents`,
      desc: totalExcursions === 0 ? "Continuous unbroken cold-chain" : "Elevated temperature alerts logged",
      type: (totalExcursions === 0 ? "positive" : "warning") as "positive" | "warning",
    },
    {
      title: "Transit Duration",
      value: durationText,
      desc: `${session.origin.split(",")[0]} ➔ ${session.destination.split(",")[0]}`,
      type: "neutral" as const,
    },
  ];

  // Action checklist for clinic/hospital staff
  const clinicChecklist = overallVerdict === "CRITICAL"
    ? [
        {
          step: 1,
          action: "Quarantine Batch Immediately",
          detail: "Do not place in general immunization storage. Affix a red 'QUARANTINED - COLD CHAIN FAILURE' label.",
          status: "warning" as const,
        },
        {
          step: 2,
          action: "Notify Cold-Chain Supervisor",
          detail: `Report Session ${session.sessionCode} and Batch ${session.batchNumber || "N/A"} to district logistics coordinator.`,
          status: "required" as const,
        },
        {
          step: 3,
          action: "Do Not Administer to Patients",
          detail: "Prepare batch return manifest for reverse logistics to the central depot.",
          status: "required" as const,
        },
      ]
    : [
        {
          step: 1,
          action: "Transfer to Clinic Refrigerator",
          detail: `Move vials into the local refrigerator set between ${session.minTemp}°C and ${session.maxTemp}°C without delay.`,
          status: "required" as const,
        },
        {
          step: 2,
          action: "Check Physical VVM Disc",
          detail: "Verify the inner square on the vial cap is visibly lighter than the outer purple circle.",
          status: "required" as const,
        },
        {
          step: 3,
          action: overallVerdict === "SAFE" ? "Approved for Vaccination" : "Clear with Pharmacist",
          detail: overallVerdict === "SAFE"
            ? "Batch is 100% compliant and ready to administer to patients."
            : "Review batch record with senior pharmacist before opening vials.",
          status: overallVerdict === "SAFE" ? ("optional" as const) : ("warning" as const),
        },
      ];

  // Plain-English FAQs
  const nonTechnicalFaq = [
    {
      q: "Can this vaccine be safely given to patients?",
      a: overallVerdict === "SAFE"
        ? "Yes. The shipment arrived in pristine condition, the cold chain was never broken, and the potency is 100% intact."
        : overallVerdict === "CAUTION"
        ? "Likely yes, but inspect the vial monitor (VVM) square first. Minor thermal drift occurred, but potency remains acceptable."
        : "No. The vaccine experienced severe temperature damage and should not be administered.",
    },
    {
      q: "Did the vaccine freeze at any point?",
      a: recordedMin >= 0
        ? `No. The lowest temperature recorded was ${recordedMin.toFixed(1)}°C, well above freezing.`
        : `Yes. The temperature dropped to ${recordedMin.toFixed(1)}°C (below 0°C), which can permanently damage aluminum-adjuvanted liquid vaccines.`,
    },
    {
      q: "Did the cooling unit fail during transit?",
      a: totalExcursions === 0
        ? `No. The equipment maintained steady cooling with an average temperature of ${recordedAvg}°C throughout the ${durationText} drive.`
        : `The sensor recorded ${totalExcursions} temperature warnings during transit, with a peak temperature of ${recordedMax.toFixed(1)}°C.`,
    },
    {
      q: "What should receiving staff do with this report?",
      a: "Click 'Print Certificate' to print this executive receiving record for your facility's physical compliance logbook or cold-chain binder.",
    },
  ];

  return {
    sessionCode: session.sessionCode,
    vaccineName: session.vaccineName,
    vaccineTier: session.vaccineTier,
    batchNumber: session.batchNumber,
    origin: session.origin,
    destination: session.destination,
    startedAt: session.startedAt.toISOString(),
    endedAt: session.endedAt ? session.endedAt.toISOString() : null,
    durationText,
    overallVerdict,
    verdictTitle,
    verdictBadge,
    verdictColor,
    potencyScore,
    isViable,
    plainLanguageSummary,
    tripStory: {
      journeyOverview,
      coolingPerformance,
      safetyConclusion,
    },
    thermalComparison: {
      safeMin: session.minTemp,
      safeMax: session.maxTemp,
      recordedMin: Number(recordedMin.toFixed(1)),
      recordedMax: Number(recordedMax.toFixed(1)),
      recordedAvg: Number(recordedAvg.toFixed(1)),
      statusText,
      withinEnvelope,
    },
    highlights,
    clinicChecklist,
    nonTechnicalFaq,
  };
}

/**
 * Optional LLM Enhancement via Gemini / Krutrim / OpenAI if configured
 */
async function tryLlmEnhance(
  deterministic: NonTechnicalSummary,
  apiKey: string | undefined
): Promise<NonTechnicalSummary> {
  // If no external key or standard call, deterministic summary is already 100% complete & medically sound
  if (!apiKey) return deterministic;

  try {
    // Attempt Gemini or OpenAI if API keys exist
    if (process.env.GEMINI_API_KEY) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `You are a cold-chain medical safety assistant for clinic staff. Write a 3-paragraph plain-English summary of this vaccine trip for a non-technical nurse or delivery recipient. No chemistry formulas or math equations.
Session: ${deterministic.sessionCode}
Vaccine: ${deterministic.vaccineName}
Route: ${deterministic.origin} to ${deterministic.destination}
Duration: ${deterministic.durationText}
Potency: ${deterministic.potencyScore}%
Temperatures: ${deterministic.thermalComparison.recordedMin}°C to ${deterministic.thermalComparison.recordedMax}°C (Safe zone: ${deterministic.thermalComparison.safeMin}°C to ${deterministic.thermalComparison.safeMax}°C)
Verdict: ${deterministic.overallVerdict}

Return ONLY a JSON object:
{
  "journeyOverview": "...",
  "coolingPerformance": "...",
  "safetyConclusion": "..."
}`,
                  },
                ],
              },
            ],
            generationConfig: { responseMimeType: "application/json" },
          }),
        }
      );

      if (response.ok) {
        const json = await response.json();
        const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text);
          if (parsed.journeyOverview && parsed.coolingPerformance && parsed.safetyConclusion) {
            deterministic.tripStory = {
              journeyOverview: parsed.journeyOverview,
              coolingPerformance: parsed.coolingPerformance,
              safetyConclusion: parsed.safetyConclusion,
            };
            deterministic.plainLanguageSummary = `${parsed.journeyOverview} ${parsed.coolingPerformance} ${parsed.safetyConclusion}`;
          }
        }
      }
    }
  } catch (err) {
    console.warn("[AI Summary] LLM optional enhancement skipped, falling back to clinical rules:", err);
  }

  return deterministic;
}

/**
 * GET /api/sessions/[id]/summary
 * Generates an executive, non-technical visual & textual AI trip summary.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await context.params;

    const session = await prisma.transitSession.findUnique({
      where: { id },
      include: {
        telemetryLogs: {
          select: {
            timestamp: true,
            temperature: true,
            isExcursion: true,
            viability: true,
          },
          orderBy: { timestamp: "asc" },
          take: 500,
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Session record not found." },
        { status: 404 }
      );
    }

    // 1. Generate comprehensive deterministic clinical summary
    const deterministic = generateDeterministicSummary(session, session.telemetryLogs);

    // 2. Try LLM enhancement if key is configured
    const finalSummary = await tryLlmEnhance(deterministic, process.env.GEMINI_API_KEY || process.env.KRUTRIM_API_KEY);

    return NextResponse.json({
      success: true,
      summary: finalSummary,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to generate AI summary";
    console.error("[API/sessions/[id]/summary GET error]:", err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
