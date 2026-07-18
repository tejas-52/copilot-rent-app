
CREATE POLICY "own rental docs read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'rental-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own rental docs insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'rental-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own rental docs update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'rental-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own rental docs delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'rental-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
