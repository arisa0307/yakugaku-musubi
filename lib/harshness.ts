// 難易度（辛口・中辛・甘口）の扱い。
//
// 設計判断（仕様の解釈。人事監修で変わりうるのでここに集約する）:
//  - 点数(rubric)の採点基準は全モード共通・固定。難易度で点数の付け方は変えない。
//  - 難易度が変えるのは「選択式コメント」だけ。
//  - 「最優先の改善点」は全モード共通で必須。
//
//  improve チップの表示プール:
//    amakuchi / chukara → min_harshness が 'chukara' 以下（＝ seed の穏当な15個）
//    karakuchi          → 上記 + 'karakuchi'（＝ 辛口5個）も表示
//  → 甘口でも「最優先の改善点」を選べるよう、甘口でも穏当な improve は出す。
//    甘口の穏やかさは「improve チップは最大1つまで」という選択制約で表現する。
//
//  選択制約(バリデーション):
//    amakuchi : improve チップは最大1つまで（good 中心）
//    chukara  : 制約なし（good / improve バランス）
//    karakuchi: 制約なし（辛口tierの指摘も表示されるが、選択数は任意）
//               ※ かつて「2つ以上必須」だったが撤廃済み

export type Harshness = "amakuchi" | "chukara" | "karakuchi";

export const HARSHNESS_ORDER: Record<Harshness, number> = {
  amakuchi: 0,
  chukara: 1,
  karakuchi: 2,
};

export const HARSHNESS_LABEL: Record<Harshness, string> = {
  amakuchi: "甘口",
  chukara: "中辛",
  karakuchi: "辛口",
};

export const HARSHNESS_DESCRIPTION: Record<Harshness, string> = {
  amakuchi: "良かった点を中心に。改善点は最優先の1つだけ受け取ります。",
  chukara: "良かった点と改善点をバランスよく受け取ります。",
  karakuchi: "改善点も含め、しっかり受け取ります（辛口向けの指摘も表示）。",
};

export const HARSHNESS_VALUES: Harshness[] = ["amakuchi", "chukara", "karakuchi"];

export function isHarshness(v: unknown): v is Harshness {
  return v === "amakuchi" || v === "chukara" || v === "karakuchi";
}

/** improve チップとして表示してよいか（good は常に表示）。 */
export function isImproveVisible(optionMin: Harshness, mode: Harshness): boolean {
  // karakuchi モードのみ karakuchi-tier まで表示。それ以外は chukara-tier まで。
  const ceiling = mode === "karakuchi" ? HARSHNESS_ORDER.karakuchi : HARSHNESS_ORDER.chukara;
  return HARSHNESS_ORDER[optionMin] <= ceiling;
}

export type EvalValidationInput = {
  mode: Harshness;
  scoredCount: number; // 採点済みの rubric 項目数
  totalRubric: number; // rubric 項目総数
  improveChipCount: number; // 選択した improve チップ数
  hasTopImprovement: boolean; // 最優先の改善点が選ばれているか
};

export type ValidationResult = {
  ok: boolean;
  errors: string[];
  /** 未入力の残数など、ボタン近くに出す補助メッセージ */
  hints: string[];
};

export function validateEvaluation(input: EvalValidationInput): ValidationResult {
  const { mode, scoredCount, totalRubric, improveChipCount, hasTopImprovement } = input;
  const errors: string[] = [];
  const hints: string[] = [];

  const remainingRubric = Math.max(0, totalRubric - scoredCount);
  if (remainingRubric > 0) {
    hints.push(`評価項目があと${remainingRubric}つ`);
    errors.push("すべての評価項目に点数をつけてください");
  }

  if (!hasTopImprovement) {
    hints.push("最優先の改善点が未選択");
    errors.push("「次に直すべき点」を1つ選んでください");
  }

  if (mode === "amakuchi" && improveChipCount > 1) {
    errors.push("甘口では改善点チップは1つまでです");
  }

  // 辛口の「改善点を2つ以上」必須制限は撤廃（送信はブロックしない）。
  // 辛口では辛口tierのコメント候補が増えるが、選択数は任意。

  return { ok: errors.length === 0, errors, hints };
}
