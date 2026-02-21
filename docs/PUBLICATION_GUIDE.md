# Publication Guide

## Release Process

### 1. Pre-Release Checks
```bash
npm test                              # All tests pass
npm run validate                      # No critical logic issues
node scripts/sync-version.js          # Sync version to manifest.json
python3 -m http.server 8000           # Manual spot-check in browser
```

### 2. Tag and Release
```bash
git tag -a v1.0.0 -m "Release 1.0.0: description"  # replace with actual version number
git push origin v1.0.0
```
Then create a GitHub Release from the tag.

### 3. Zenodo Archive
If Zenodo GitHub integration is enabled, it archives automatically within 24 hours and assigns a DOI.

To enable: [zenodo.org](https://zenodo.org) → Profile → GitHub → toggle on the repository.

### 4. Record DOI
After Zenodo assigns the DOI (`10.5281/zenodo.NNNNNNN`):
```bash
# Update CITATION.cff, README.md with the DOI
git add CITATION.cff README.md
git commit -m "Add Zenodo DOI"
git push
```

## Future Releases

1. Update version in CITATION.cff and CHANGELOG.md
2. Run `npm test` and `npm run validate`
3. Create annotated tag and push
4. Create GitHub Release
5. Zenodo archives automatically (each version gets its own DOI)

## Citation

After publication, users cite via CITATION.cff or Zenodo's built-in citation export (BibTeX, APA, RIS, etc.).

## References
- [Zenodo GitHub Integration](https://docs.zenodo.org/features/github/)
- [Citation File Format Spec](https://citation-file-format.github.io/)
