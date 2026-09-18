// ユーザーネーム方式のログイン。
// メール確認をオフにしている前提で、ユーザーネームから固定のダミーメールを生成し
// Supabase Auth（email provider）に渡す。メールは送らない。
//
//  ・大文字小文字は区別しない（ログインの取り違え防止）。
//  ・日本語などの非ASCIIも使えるよう UTF-8 を16進エンコードして localpart にする
//    （localpart を ASCII 英数字に保つため）。
//  ・表示名には元のユーザーネーム（入力そのまま）を使う。

const EMAIL_DOMAIN = "yakugaku.invalid";

// localpart 上限に収めるためのユーザーネーム最大バイト数（hexで2倍 + prefix 'u'）。
export const USERNAME_MAX_BYTES = 28;

export function usernameByteLength(username: string): number {
  return new TextEncoder().encode(username.trim().toLowerCase()).length;
}

export function usernameToEmail(username: string): string {
  const norm = username.trim().toLowerCase();
  const bytes = new TextEncoder().encode(norm);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return `u${hex}@${EMAIL_DOMAIN}`;
}
