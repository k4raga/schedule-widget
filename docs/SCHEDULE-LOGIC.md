# Schedule Logic

## Core Idea

The working day is organized around two operating modes:

1. A morning autonomous Codex sprint on the work computer.
2. An operator block from 14:00 to 16:00.

In the morning, Codex receives one large prepared work task and moves it as independently as possible until the session review around 14:00. During that time, personal attention goes to the laptop and personal projects.

After 14:00, attention switches back to the work computer: review the result, run operational checks, answer work messages, and prepare the next sprint.

## Base Day

```text
09:00-14:00  Work computer: Codex runs one autonomous sprint
09:05-13:45  Laptop: personal project, deep work
13:45-14:00  Close personal context and write the next step

14:00-16:00  Work computer: operator block
16:00        Workday closed
```

## Morning Sprint

Goal: give Codex one large work task that can move autonomously.

Good tasks:

- feature implementation
- bug fix
- writing or updating tests
- local refactor
- problem investigation followed by a patch
- preparing changes for PR

The morning task should be prepared before the day starts so it can be launched at 09:00 without planning work.

## Personal Block

Goal: use the time while work Codex is running for personal projects on the laptop.

Rule: do not scatter attention into work context before 14:00 unless the sprint is clearly blocked.

At the end of the personal block, leave a short note:

```text
What I did:
Where I stopped:
Next step:
```

## Operator Block

Goal: manage the work process instead of starting a new large manual development task.

The block includes:

- review the morning sprint result
- read the Codex report
- inspect the diff
- run or check tests
- accept, reject, or clarify the result
- close small operational tasks
- answer work messages and statuses
- process incoming tasks
- choose the next large sprint
- prepare the next morning Sprint Card

Main rule: the next sprint is planned from 14:00 to 16:00, not in the morning.

## Daily Cycle

```text
Day N, 14:00-16:00:
- review sprint N
- close operations
- prepare sprint N+1

Day N+1, 09:00:
- launch the already prepared sprint
- move to the personal laptop project
```

## Sprint Card

```text
Date:

Morning sprint 09:00-14:00:
Goal:
Context:
Can change:
Cannot touch:
How to verify:
Expected report:

Operator block 14:00-16:00:
1. Review the morning sprint result
2. Close operational tasks
3. Prepare the next Sprint Card
```

## Formula

```text
09:00-14:00  Work Codex works
09:05-13:45  I move personal projects
14:00-16:00  I manage the work process
16:00        Work is closed
```
