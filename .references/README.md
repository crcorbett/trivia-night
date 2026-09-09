# Upstream implementation references

These shallow Git submodules are read-only source references for the versions
used by this repository. They are not workspace packages, app dependencies, or
deployed files.

| Reference | Upstream | Release | Checked-out commit |
| --- | --- | --- | --- |
| `.references/effect` | [Effect TS](https://github.com/Effect-TS/effect) | `effect@4.0.0-beta.107` | `3c495ae7c96d43bfc3b8020250562a194c2c895e` |
| `.references/alchemy` | [Alchemy](https://github.com/alchemy-run/alchemy) | `v2.0.0-beta.76` | `e5b1b598392585e0f2d5fa03ac475cd076dbc0f8` |

After a normal clone, fetch the references with:

```bash
git submodule update --init --depth 1
```

To refresh a reference deliberately, change the submodule checkout and record
the new release and commit here in the same change. Do not edit or run the
upstream repositories as part of the trivia-night application.
