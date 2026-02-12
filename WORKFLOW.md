# Team Collaboration Workflow

This document outlines our team's workflow for contributing to the `Yooro` project. We follow a **Feature Branch Workflow** to ensure stability on the `main` branch.

## core Principle

> **The `main` branch is the source of truth.**  
> Never push directly to `main`. Always use a Pull Request (PR).

## The Workflow

### 1. Sync Before You Start
Before starting any new work, make sure your local repository is up to date.

```bash
git checkout main
git pull origin main
```

### 2. Create a Feature Branch
Create a new branch for your specific task (feature, bugfix, or experiment). Use a descriptive name.

```bash
# Format: git checkout -b [type]/[description]
git checkout -b feature/invoice-comparison-ui
# or
git checkout -b fix/auth-token-error
```

### 3. Make Changes & Commit
Work on your branch. Make frequent, small commits with clear messages.

```bash
git add .
git commit -m "Add new comparison chart component"
```

### 4. Push Your Branch
Push your branch to the shared repository.

```bash
git push -u origin feature/invoice-comparison-ui
```

### 5. Open a Pull Request (PR)
1.  Go to the [GitHub Repository](https://github.com/keremerciyes/Yooro).
2.  You should see a prompt to "Compare & pull request" for your recently pushed branch.
3.  Click it, fill in the details of what you changed, and assign a reviewer (a coworker).

### 6. Review & Merge
1.  Coworkers review the code, leave comments, and approve.
2.  Once approved, the PR can be merged into `main` via the GitHub UI.
3.  **Delete** the feature branch after merging to keep the repo clean.

### 7. Sync Again
Everyone else should now pull the latest `main` to get your changes.

```bash
git checkout main
git pull origin main
```

---

## 🚀 Summary for Daily Work

1.  `git checkout main`
2.  `git pull`
3.  `git checkout -b feature/my-new-task`
4.  ... code ... commit ...
5.  `git push`
6.  Create PR on GitHub
