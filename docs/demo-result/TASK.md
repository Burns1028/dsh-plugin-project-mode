# Work to finish

Add `--sort title` to the existing note bundler. It should sort notes by their
first level-one Markdown heading, case-insensitively, Z to A. With no `--sort`
option, keep the current filename order. Preserve the existing output format and
`--output` behavior. The existing title-sort test describes the accepted feature.

Write `docs/usage.md`: requirements, commands, default order, title order, and a
short example using the three notes. Source and documentation can be handled by
different people without changing the same files.

Accepted requirement after review: the title order is Z to A (case-insensitive).
The feature test and implementation reflect this; docs and generated output must
agree.
