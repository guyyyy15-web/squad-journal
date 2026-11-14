-- One-off: replace the old emoji avatars with insignia (members.emoji now holds an insignia key).
UPDATE members SET emoji = CASE account_id
  WHEN 'account.e44e682c55e14d098eee845564e7210e' THEN 'star'       -- GuyAviv
  WHEN 'account.a611c89ad9df45f6a9407cc315175062' THEN 'bolt'       -- BrozaontheBeat
  WHEN 'account.35f0e56317324dbc858400399ae43980' THEN 'spade'      -- elcrapo
  WHEN 'account.c75a1a3d277f4a8e82e388f1ef701d75' THEN 'crosshair'  -- FLORES10
  WHEN 'account.36c29d8290bc4e22b95f5bd7f2988053' THEN 'skull'      -- Ghost1205
  WHEN 'account.e5778864039f4a4bbe0d344eace913f8' THEN 'wings'      -- IIFif0II
  WHEN 'account.2dc8248f84a749be8e0511b7aa8a810c' THEN 'dagger'     -- X_Hibit
  ELSE emoji END;
UPDATE sessions SET summary_json = NULL;
