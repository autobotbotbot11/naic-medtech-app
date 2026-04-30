# Builder UX Lab

This folder is an isolated prototype space for rethinking the forms builder workflow.

Purpose:
- Find why the real builder feels heavy.
- Test interaction models without touching the working app.
- Keep experiments disposable until one direction feels clearly better.

Rules:
- No backend.
- No database.
- No dependency on the real app runtime.
- Use fake form data only.
- Prefer small passes over large rewrites.

Current prototype:
- `index.html` loads a recursive content-builder lab.
- `styles.css` carries the visual direction.
- `app.js` carries fake state and simple interactions.
- Containers can now collapse/expand to test whether recursive content feels lighter.

Working mental model:
- `container` holds containers and fields.
- `field` is a leaf input. It stores one answer and does not contain children.
- Section/group language is intentionally removed from the visible builder for now.
- If section/group becomes useful later, it should be a container display setting, not a separate primitive.

Evaluation questions:
- Does editing feel attached to the block being edited?
- Does the user always know where they are?
- Are primary actions obvious without reading helper text?
- Does the builder feel like building a form, or like managing settings?
- Is the right-side inspector helpful or just extra weight?
- Is it better if every container has an inline `Add content here` area?
- Does removing section/group reduce mental weight?
- Do collapsed containers make long forms easier to scan without hiding too much?
