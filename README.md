# 薬学むすび｜模擬面接 相互評価アプリ

オンライン模擬面接会で使う、相互評価と「自分あて集計」閲覧のためのアプリ。
Zoom ブレイクアウトで面接を行い、このアプリは **評価入力** と **自分あてフィードバックの閲覧** だけを担う。

- スタック: Next.js (App Router) + TypeScript + Supabase (Auth / DB / RLS) + Vercel
- 認証: Supabase Auth マジックリンク（パスワード不要）
- 無料枠内で運用

## 最重要要件（設計の核）

1. **自分あてだけ**：評価を受ける側は自分あての集計しか見られない。他人あての評価は取得できない（RLS）。
2. **評価者の匿名性**：受け手には評価者が誰か一切出さない。集計は `SECURITY DEFINER` の RPC `get_my_feedback` 経由でのみ返し、`evaluator_id` は含めない。
3. **自由記述は任意**：空欄でも送信できる。自由記述は2件以上集まったときだけ受け手に表示（発信者特定を避ける）。

---

## セットアップ手順

### 1. Supabase プロジェクトを用意（別アカウント運用）

1. 新しい Supabase アカウント／プロジェクトを作成（リージョンは **Tokyo (ap-northeast-1)** 推奨）。
2. **SQL Editor** で [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) の内容を貼り付けて実行。
   - テーブル / RLS / RPC / 共通 seed（rubric・comment）がすべて入る。
3. **Authentication → URL Configuration** に以下を登録:
   - **Site URL**: `http://localhost:3000`（本番は Vercel の URL）
   - **Redirect URLs**: `http://localhost:3000/**` と `https://<あなたのアプリ>.vercel.app/**`
   - ← マジックリンクのコールバック `…/auth/callback` を通すために必須。
4. **Project Settings → API** から `URL` と `anon public` キーを控える。

### 2. 環境変数

`.env.local.example` を `.env.local` にコピーして値を入れる:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...   # または sb_publishable_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. ローカル起動

```
npm install
npm run dev
```

http://localhost:3000 → メールアドレスでログインリンクを受け取り、クリックして入る。

### 4. 管理者を設定

一度ログインして `profiles` 行を作ってから、SQL Editor で
[`supabase/helpers.sql`](supabase/helpers.sql) の「1) 自分を管理者にする」を自分のメールで実行。
以後 `/admin` からイベント作成と参加者・グループ割り当てができる。

### 5. Vercel デプロイ

- リポジトリを Vercel に接続し、同じ環境変数を設定（`NEXT_PUBLIC_APP_URL` は本番 URL に）。
- デプロイ後、その URL を Supabase の Redirect URLs にも追加する。

---

## 当日の流れ

1. （事前）参加者全員が一度ログイン → `/admin/<eventId>` でグループ番号を割り当て。
2. 各自 `/events/<eventId>` で **自分が受け取るフィードバックの強さ**（甘口／中辛／辛口）を設定。
3. Zoom で面接。終わったら `/events/<eventId>` から相手を選び、`evaluate` で評価を送信（2〜3分）。
4. 全員送信後、各自 `/events/<eventId>/feedback` で **自分あての匿名集計** を確認。

> P0 の「評価入力」と「フィードバック閲覧」が動けば当日は回せる。
> admin が間に合わなければ [`supabase/helpers.sql`](supabase/helpers.sql) の SQL でイベント／参加者を用意できる。

---

## 難易度（甘口・中辛・辛口）の扱い

- **点数(rubric)の採点基準は全モード共通・固定**。難易度で点数の付け方は変えない（人・回をまたいで比較可能に保つため）。
- 難易度が変えるのは **選択式コメントだけ**（受け手が `requested_harshness` を設定 → フォームが出し分け）。
  - 甘口: 改善点チップは最大1つ（good 中心）
  - 中辛: good / improve バランス
  - 辛口: 改善点チップ2つ以上で送信可
- 「最優先の改善点」1問は **全モード共通で必須**。

詳細な解釈と判断は [`lib/harshness.ts`](lib/harshness.ts) 冒頭コメントに集約。

## 画面

| ルート | 内容 | 優先度 |
| --- | --- | --- |
| `/login` | マジックリンク | P0 |
| `/events` | 参加イベント一覧 | P0 |
| `/events/[id]` | グループ、評価する相手（送信済み表示）、希望強度設定 | P0 |
| `/events/[id]/evaluate/[evaluateeId]` | 評価入力 | P0 |
| `/events/[id]/feedback` | 自分あて集計（匿名） | P0 |
| `/admin`, `/admin/[eventId]` | イベント作成・参加者/グループ割り当て | P1 |
| `/history` | 項目別スコアの推移（2回目以降で有効） | P2 |

## 評価基準の改訂について

`rubric_items` は確定後は極力変えない（改訂すると過去回と厳密には比較できなくなる）。
項目を足す場合も既存項目は据え置き、追加する形にする。
`get_my_history` は rubric を **id ではなく label** で束ねるので、改訂されても推移は追える。
