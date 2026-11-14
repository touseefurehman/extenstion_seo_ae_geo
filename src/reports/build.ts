import { runAnalyzers } from '../analyzers';
import { inspectSchema } from '../analyzers/schema/inspect';
import { CONFIG_VERSION, DEFAULT_SCORING } from '../scoring/config';
import { scoreChecks, summarize } from '../scoring/engine';
import type { AuditReport, ScoringConfig } from '../types/report';
import type { PageSnapshot } from '../types/snapshot';
import { slimSnapshot } from './slim';

export interface BuildOptions {
  id?: string;
  now?: () => Date;
  scoring?: ScoringConfig;
}

/** Snapshot -> analyzers -> scoring -> AuditReport. Pure apart from id generation. */
export function buildReport(snapshot: PageSnapshot, options: BuildOptions = {}): AuditReport {
  const checks = runAnalyzers(snapshot);
  const breakdown = scoreChecks(checks, options.scoring ?? DEFAULT_SCORING);
  const schema = inspectSchema(snapshot);
  return {
    id: options.id ?? crypto.randomUUID(),
    version: 1,
    url: snapshot.url,
    title: snapshot.title,
    createdAt: (options.now?.() ?? new Date()).toISOString(),
    configVersion: CONFIG_VERSION,
    overall: breakdown.overall.score,
    categories: {
      technical: {
        score: breakdown.categories.technical.score,
        applicableChecks: breakdown.categories.technical.applicableChecks,
      },
      onpage: {
        score: breakdown.categories.onpage.score,
        applicableChecks: breakdown.categories.onpage.applicableChecks,
      },
      aeo: {
        score: breakdown.categories.aeo.score,
        applicableChecks: breakdown.categories.aeo.applicableChecks,
      },
      geo: {
        score: breakdown.categories.geo.score,
        applicableChecks: breakdown.categories.geo.applicableChecks,
      },
    },
    breakdown,
    summary: summarize(checks),
    checks,
    schema: {
      ...schema,
      rawJsonLd: schema.rawJsonLd.map((r) => ({
        ...r,
        raw: r.raw.slice(0, 20_000),
        truncated: r.truncated || r.raw.length > 20_000,
      })),
    },
    page: slimSnapshot(snapshot),
  };
}
