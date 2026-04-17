/**
 * 雙向 Commit ↔ Ticket 索引 (T0154 假設 2 實測用)
 *
 * 對應 T0153 報告中的 CommitIndex 設計:
 *   ticketToCommits: Map<ticketId, commitHash[]>
 *   commitToTickets: Map<commitHash, ticketId[]>
 *
 * 建構來源:commit message 掃描 `T\d{4}` regex
 */

import type { SynthCommit } from './synthGen'

const TICKET_RE = /T\d{4}/g

export class CommitIndex {
  ticketToCommits = new Map<string, string[]>()
  commitToTickets = new Map<string, string[]>()

  /**
   * 從 commit 陣列建立雙向索引。
   *
   * 真實場景:從 `git log --format='%H %s'` 輸出 parse。
   */
  buildFromCommits(commits: SynthCommit[]): void {
    this.ticketToCommits.clear()
    this.commitToTickets.clear()

    for (const c of commits) {
      // 路徑 A:使用合成資料的預計算 tickets (最快)
      // 路徑 B:從 message regex 掃描 (模擬真實場景)
      // 兩者都測,benchmark 呼叫 buildFromMessages 走 B
      if (c.tickets.length === 0) continue

      this.commitToTickets.set(c.hash, c.tickets)
      for (const ticket of c.tickets) {
        let arr = this.ticketToCommits.get(ticket)
        if (!arr) {
          arr = []
          this.ticketToCommits.set(ticket, arr)
        }
        arr.push(c.hash)
      }
    }
  }

  /**
   * 從 commit message 字串掃描建索引 (模擬真實 `git log` parse)。
   *
   * 這是更貼近現實的建構路徑 — regex 掃描佔主要成本。
   */
  buildFromMessages(commits: SynthCommit[]): void {
    this.ticketToCommits.clear()
    this.commitToTickets.clear()

    for (const c of commits) {
      const matches = c.message.match(TICKET_RE)
      if (!matches || matches.length === 0) continue

      // 去重
      const unique: string[] = []
      for (const m of matches) {
        if (!unique.includes(m)) unique.push(m)
      }

      this.commitToTickets.set(c.hash, unique)
      for (const ticket of unique) {
        let arr = this.ticketToCommits.get(ticket)
        if (!arr) {
          arr = []
          this.ticketToCommits.set(ticket, arr)
        }
        arr.push(c.hash)
      }
    }
  }

  lookupCommitsByTicket(ticket: string): string[] {
    return this.ticketToCommits.get(ticket) ?? []
  }

  lookupTicketsByCommit(hash: string): string[] {
    return this.commitToTickets.get(hash) ?? []
  }

  stats(): { tickets: number; commitsWithTickets: number } {
    return {
      tickets: this.ticketToCommits.size,
      commitsWithTickets: this.commitToTickets.size,
    }
  }
}

/**
 * 臨時 scan 無索引反查 (對照組) — 展示為何一定要預建索引。
 *
 * 每次呼叫掃全部 commits,O(N)。
 */
export function scanCommitsByTicketLinear(
  commits: SynthCommit[],
  ticket: string
): string[] {
  const result: string[] = []
  const needle = ticket
  for (const c of commits) {
    if (c.message.includes(needle)) {
      result.push(c.hash)
    }
  }
  return result
}
