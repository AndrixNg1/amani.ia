# License decision — awaiting owner approval

No repository-level LICENSE, copyright notice, author identity or Git remote was
present during setup. The NestJS manifests already contain `license: UNLICENSED`
and empty author fields; these have been preserved. The root and frontend
manifests did not declare a license. No rights holder has been inferred from a
local account name, project name or dependency license.

The owner must select the distribution policy: keep the project private with
terms chosen by the owner, or approve an open-source license (for example MIT,
Apache-2.0, GPL-3.0-only or AGPL-3.0-only) after reviewing its actual terms and
compatibility with the intended distribution. These are options, not a selection.

After approval, record the exact license identifier/text, confirmed rights holder
and applicable year, and align the root/workspace manifests. Until then, no
LICENSE file or copyright attribution is added and all npm packages remain
private. Third-party dependencies retain their own licenses.

See the [npm license field documentation](https://docs.npmjs.com/cli/v10/configuring-npm/package-json/#license)
and [SPDX license texts](https://spdx.org/licenses/) for identifiers and terms.
