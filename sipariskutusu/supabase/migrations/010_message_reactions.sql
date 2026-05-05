-- Mesaj tepkileri (emoji reactions)
-- Her kullanıcı, her mesaja her emojiden en fazla bir tane ekleyebilir.

CREATE TABLE IF NOT EXISTS public.message_reactions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  UUID        NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji       TEXT        NOT NULL CHECK (char_length(emoji) <= 8),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (message_id, user_id, emoji)
);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- Görüntüleme: Kullanıcı, katıldığı konuşmadaki mesajların tepkilerini görebilir
CREATE POLICY "reactions_select" ON public.message_reactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.conversations c ON c.id = m.conversation_id
      WHERE m.id = message_reactions.message_id
        AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())
    )
  );

-- Ekleme: Sadece kendi adına tepki ekleyebilir
CREATE POLICY "reactions_insert" ON public.message_reactions
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Silme: Sadece kendi tepkisini silebilir
CREATE POLICY "reactions_delete" ON public.message_reactions
  FOR DELETE USING (user_id = auth.uid());

-- Realtime yayın için tablo yetkilendirmesi
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;

-- DELETE realtime event'lerin tüm alanları içermesi için gerekli
ALTER TABLE public.message_reactions REPLICA IDENTITY FULL;
