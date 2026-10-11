# Public-reader source and licensing

The engine now uses the original MIT-licensed fivetaku/insane-search source at commit `d29166fbd2a8e54cb77e0e47a52f456709417973`, obtained directly from https://github.com/fivetaku/insane-search. Its unchanged preferred source, original license and file digest manifest are under `vendor/public-reader-independent` in the Scrum package. The engine template and WAF configuration copies retain that MIT license; `engine/LICENSE.insane-search` reproduces its notice.

The Python host interfaces and the adapters under `independent/public_reader_*` are independently authored. They add surrogate retrieval, target validation and live/snapshot/proxy provenance without copying the OMO implementation. Source-content trust remains untrusted even when a retrieval label identifies an origin or archive.

The retired OMO-modified engine is kept only as private development evidence and is excluded from the npm package. Other guides and cookie helpers in this skill still have unresolved replacement/acceptance work. This engine milestone does not certify the whole skill or package for public release.
