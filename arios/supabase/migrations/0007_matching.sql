-- ============================================================================
-- 0007 マッチング化: 売りたい/買いたい を メーカー×車種 でマッチさせる
--  - kind: SELL(売りたい) / BUY(買いたい)
--  - manufacturer / model: マッチのキー（必須運用）
--  - price: 販売価格(SELL) または 予算(BUY)（円）
--  - priority: 売り手の表示順（管理者が変更。小さいほど上。既定は価格の安い順）
-- ============================================================================
alter table inquiries
  add column if not exists kind text not null default 'SELL',
  add column if not exists manufacturer text,
  add column if not exists model text,
  add column if not exists price bigint,
  add column if not exists priority int;

-- マッチング検索用（メーカー×車種×種別）
create index if not exists inquiries_match_idx
  on inquiries (manufacturer, model, kind);
