# Structured data

QuixSEO emits one linked `primary` JSON-LD graph through the host. WebSite and
WebPage are defaults; truthful Organization/Person identity can be added in
settings. Per-entry JSON accepts WebPage, WebSite, Article, BlogPosting,
BreadcrumbList, FAQPage, Product, LocalBusiness, Organization and Person.

Examples for the advanced schema field:

```json
{"type":"BlogPosting","author":"Actual author name"}
```

```json
{"type":"FAQPage","visibleContentConfirmed":true,"questions":[{"question":"How do I water seedlings?","answer":"Keep the soil moist without waterlogging it."}]}
```

```json
{"type":"Product","name":"Actual item","description":"Accurate description","image":"https://example.com/item.jpg","price":"19.99","currency":"USD","availability":"InStock","visibleContentConfirmed":true}
```

Product requires name, image and description; offers require both price and
three-letter currency. LocalBusiness requires name, street, city and two-letter
country. These code fields are format-checked; verify their actual ISO meanings.
FAQ requires non-empty visible question/answer pairs. BreadcrumbList requires
named absolute-URL breadcrumbs. FAQ, Product and LocalBusiness require explicit
confirmation that facts appear on the public page. This is an editor attestation,
not automatic factual verification. Organization/Person overrides require a name.

Article dates come only from the supplied public page context. Author, product
facts and identity are not invented. No review/rating controls exist. Unknown
properties are rejected. Required-field errors block every change entry point.
The host escapes JSON-LD for HTML safety. Core data/context must also be accurate.
Schema does not guarantee eligibility for a Google feature or rich result.
