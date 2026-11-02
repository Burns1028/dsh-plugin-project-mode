# Work to finish

Add `--sort title` to the existing note bundler. It should sort notes by their
first level-one Markdown heading, case-insensitively, A to Z. With no `--sort`
option, keep the current filename order. Preserve the existing output format and
`--output` behavior. The existing title-sort test describes the new feature.

Write `docs/usage.md`: requirements, commands, default order, title order, and a
short example using the three notes. Source and documentation can be handled by
different people without changing the same files.

This initial order can be revised during review. If that happens, update the
test to the accepted requirement and make the docs and generated output agree.
