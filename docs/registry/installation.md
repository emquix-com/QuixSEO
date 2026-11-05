## Requirements

The tested production setup is Linux, Node.js 24, EmDash 1.4.0 and the official Node/workerd sandbox. A packaged 0.0.2 build passed production browser workflows and restart checks. Fresh installation from the public registry remains a separate verification step.

Windows development was tested; Windows standalone production and deployed Cloudflare are not verified targets. Cloudflare sandboxed plugins require Workers Paid.

## Install and set up

1. Back up your existing site and confirm its plugin sandbox is configured.
2. Open Registry in EmDash, find **QuixSEO** from **@emquix.com**, and select version **0.0.2**. Review the permissions and confirm installation.
3. Enable native SEO and routability for the content types you use. Configure your public Site URL in EmDash Settings.
4. Open **QuixSEO → Setup & settings**, then open a post or page and its QuixSEO panel.
5. Add a focus keyphrase and choose **Save QuixSEO settings**. Save native SEO values through EmDash's own controls.
6. Start a site review from **QuixSEO → Overview**. Automatic processing requires scheduled tasks on the host.

Your theme must use EmDash's public SEO integration to render metadata. Installing a plugin cannot repair a theme that omits those hooks.

The optional llms.txt generator is disabled by default. Serving it at `/llms.txt` needs a host route; robots.txt changes are manual.

[Host integration and installation details](https://github.com/emquix-com/QuixSEO/blob/main/docs/installation.md)
