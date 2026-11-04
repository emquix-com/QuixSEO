# WordPress SEO migration

QuixSEO 0.0.1 imports mapped plugin-owned data and previews native SEO values.
**It cannot save native titles, descriptions, canonical URLs or noindex through
the tested EmDash 1.3.1 and 1.4.0 sandboxes.** A mixed plan is blocked in full. Apply reviewed native
values with core's SEO UI, then create a separate import containing only the
plugin-owned source keys you want to save. Nothing is silently discarded as a
successful native import.

Export content with WordPress Tools → Export (WXR). Create an explicit mapping
file after content has been imported into EmDash:

```json
[{"sourceId":"42","collection":"posts","id":"ACTUAL_EMDASH_ID"}]
```

```sh
python3 scripts/convert-wxr.py wordpress.xml mapping.json --source yoast --output mapped.json
```

Use `--source rankmath` for Rank Math. The converter reads only matching metadata,
rejects DTD/entities and duplicate/missing mappings, and creates a new output
file without overwriting an earlier conversion. It never connects to a live
WordPress database. Review the output and split into arrays of at most 20 records
and 48 KB. In QuixSEO Migration, paste a batch, prepare every entry, review all
warnings and confirm each supported change. History preserves operation IDs,
progress, before/after values and conditional revert.

A minimal import:

```json
[{"source":"yoast","collection":"posts","id":"ACTUAL_EMDASH_ID","meta":{"_yoast_wpseo_focuskw":"garden care","_yoast_wpseo_is_cornerstone":"1"}}]
```

| Source data | Mapping |
|---|---|
| Yoast `_yoast_wpseo_title`, `metadesc`, `canonical` | Native preview only |
| Yoast `focuskw`, `is_cornerstone` | Keyphrases, cornerstone |
| Yoast `meta-robots-noindex` | `1` noindex; `2` index; inherited `0` warned |
| Yoast `meta-robots-nofollow` | Additional nofollow |
| Yoast `opengraph-*`, `twitter-*` | Plugin social overrides |
| Rank Math `rank_math_title`, `description`, `canonical_url` | Native preview only |
| Rank Math `focus_keyword`, `pillar_content` | Phrases, cornerstone |
| Rank Math `robots` decoded array | Native indexing preview, nofollow/nosnippet |
| Rank Math `facebook_*`, `twitter_*` | Plugin social overrides |

Prefixes apply to all suffixes in the table. Rank Math uses `rank_math_canonical_url`; unknown keys produce a warning. PHP-serialized arrays are not executed or automatically
unserialized. For robots, explicitly replace the exported value with a reviewed
JSON string array, such as `["noindex","nofollow"]`, before importing.

Only title/site/separator/excerpt template tokens are recognized. Entry-dependent
variables are warned and deferred to a separate template preview; unsupported
variables omit the field. Global plugin settings, serialized schema, proprietary
functions, images referenced only by WordPress IDs and paid data are not imported.
Redirects use the separate exact-path JSON tool, one reviewed rule at a time.
No Yoast/Rank Math source code is included.
