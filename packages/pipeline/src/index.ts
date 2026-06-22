// Pipeline board engine for MightyOps

export interface PipelineStage {
  id: string;
  name: string;
  order: number;
  color?: string;
  probability?: number;
  is_closed_won?: boolean;
  is_closed_lost?: boolean;
}

export interface PipelineCard {
  id: string;
  title: string;
  value?: number;
  currency?: string;
  probability?: number;
  stage_id: string;
  assignee_id?: string;
  company?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

export interface Pipeline {
  id: string;
  name: string;
  stages: PipelineStage[];
}

export interface BoardColumn {
  stage: PipelineStage;
  cards: PipelineCard[];
  totalValue: number;
}

export interface BoardView {
  pipeline: Pipeline;
  columns: BoardColumn[];
  totalCards: number;
  totalValue: number;
}

/** Build a board view from stages + cards. */
export function buildBoardView(pipeline: Pipeline, cards: PipelineCard[]): BoardView {
  const stageMap = new Map(pipeline.stages.map((s) => [s.id, s]));
  const columnMap = new Map<string, BoardColumn>(
    pipeline.stages
      .sort((a, b) => a.order - b.order)
      .map((s) => [s.id, { stage: s, cards: [], totalValue: 0 }]),
  );

  for (const card of cards) {
    const col = columnMap.get(card.stage_id);
    if (col) {
      col.cards.push(card);
      col.totalValue += (card.value ?? 0) * ((card.probability ?? 100) / 100);
    }
  }

  const columns = Array.from(columnMap.values());
  return {
    pipeline,
    columns,
    totalCards: cards.length,
    totalValue: columns.reduce((sum, c) => sum + c.totalValue, 0),
  };
}

/** Sort cards within a column by value descending. */
export function sortCardsByValue(cards: PipelineCard[]): PipelineCard[] {
  return [...cards].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
}

/** Filter cards by assignee. */
export function filterByAssignee(cards: PipelineCard[], userId: string): PipelineCard[] {
  return cards.filter((c) => c.assignee_id === userId);
}

/** Compute weighted pipeline value for open stages. */
export function weightedPipelineValue(cards: PipelineCard[], stages: PipelineStage[]): number {
  const closedIds = new Set(
    stages.filter((s) => s.is_closed_won || s.is_closed_lost).map((s) => s.id),
  );
  return cards
    .filter((c) => !closedIds.has(c.stage_id))
    .reduce((sum, c) => sum + (c.value ?? 0) * ((c.probability ?? 50) / 100), 0);
}

/**
 * PipelineBoardClient wraps the MightyOps API for deal pipeline management.
 */
export class PipelineBoardClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
  ) {}

  private async fetch<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail ?? `HTTP ${res.status}`);
    }
    return res.json() as Promise<T>;
  }

  /** Fetch all deals in a kanban-friendly format. */
  async getBoardView(): Promise<BoardView> {
    const deals = await this.fetch<PipelineCard[]>("/deals");
    const pipeline: Pipeline = {
      id: "default",
      name: "Sales Pipeline",
      stages: [
        { id: "lead", name: "Lead", order: 1, probability: 10 },
        { id: "qualified", name: "Qualified", order: 2, probability: 25 },
        { id: "proposal", name: "Proposal", order: 3, probability: 50 },
        { id: "negotiation", name: "Negotiation", order: 4, probability: 75 },
        { id: "won", name: "Won", order: 5, probability: 100, is_closed_won: true },
        { id: "lost", name: "Lost", order: 6, probability: 0, is_closed_lost: true },
      ],
    };
    return buildBoardView(pipeline, deals);
  }

  /** Move a deal to a new stage. */
  moveDeal(dealId: string, stageId: string) {
    return this.fetch<PipelineCard>(`/deals/${dealId}`, {
      method: "PATCH",
      body: JSON.stringify({ stage: stageId }),
    });
  }

  /** Create a new deal. */
  createDeal(data: Partial<PipelineCard> & { title: string }) {
    return this.fetch<PipelineCard>("/deals", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }
}
