DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'WikiPage'
      AND column_name = 'lastEditorName'
  ) THEN
    ALTER TABLE "WikiPage"
    ALTER COLUMN "lastEditorName" DROP NOT NULL;
  END IF;
END
$$;
