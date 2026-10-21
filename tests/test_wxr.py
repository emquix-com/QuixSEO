import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("convert_wxr", "scripts/convert-wxr.py")
converter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(converter)


class WxrTests(unittest.TestCase):
    def test_explicit_mapping_and_dtd_rejection(self):
        with tempfile.TemporaryDirectory(prefix="quixseo-wxr-") as directory:
            root = Path(directory)
            wxr, mapping = root / "export.xml", root / "mapping.json"
            wxr.write_text('<rss xmlns:wp="http://wordpress.org/export/1.2/"><channel><item><wp:post_id>42</wp:post_id><wp:postmeta><wp:meta_key>_yoast_wpseo_title</wp:meta_key><wp:meta_value><![CDATA[Gardens & flowers]]></wp:meta_value></wp:postmeta></item></channel></rss>')
            mapping.write_text(json.dumps([{"sourceId": "42", "collection": "posts", "id": "emdash-id"}]))
            self.assertEqual(converter.convert(wxr, mapping, "yoast"), [{"source": "yoast", "collection": "posts", "id": "emdash-id", "meta": {"_yoast_wpseo_title": "Gardens & flowers"}}])
            wxr.write_text('<!DOCTYPE rss [<!ENTITY secret SYSTEM "file:///etc/passwd">]><rss/>')
            with self.assertRaisesRegex(ValueError, "DTD"):
                converter.convert(wxr, mapping, "yoast")

    def test_missing_and_duplicate_mapping(self):
        with tempfile.TemporaryDirectory(prefix="quixseo-wxr-") as directory:
            root = Path(directory)
            wxr, mapping = root / "export.xml", root / "mapping.json"
            wxr.write_text('<rss><channel/></rss>')
            item = {"sourceId": "42", "collection": "posts", "id": "emdash-id"}
            mapping.write_text(json.dumps([item]))
            with self.assertRaisesRegex(ValueError, "absent"):
                converter.convert(wxr, mapping, "yoast")
            mapping.write_text(json.dumps([item, item]))
            with self.assertRaisesRegex(ValueError, "Duplicate"):
                converter.convert(wxr, mapping, "yoast")

    def test_rejects_utf16_entity_bypass(self):
        with tempfile.TemporaryDirectory(prefix="quixseo-wxr-") as directory:
            root = Path(directory)
            wxr, mapping = root / "export.xml", root / "mapping.json"
            wxr.write_bytes('<!DOCTYPE rss><rss/>'.encode("utf-16"))
            mapping.write_text("[]")
            with self.assertRaisesRegex(ValueError, "UTF-8"):
                converter.convert(wxr, mapping, "rankmath")


if __name__ == "__main__":
    unittest.main()
