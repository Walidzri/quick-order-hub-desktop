# Architecture Quick Order Hub

```
┌─────────────────────────────────────────────────────────────────┐
│                         ELECTRON APP                            │
│                                                                 │
│  ┌──────────────────────┐      ┌──────────────────────────────┐ │
│  │   RENDERER PROCESS   │      │       MAIN PROCESS           │ │
│  │   (Frontend)         │      │       (Backend embarqué)     │ │
│  │                      │      │                              │ │
│  │  React + TypeScript  │      │  Fastify :3001               │ │
│  │  └── Pages           │ HTTP │  ├── /api/orders             │ │
│  │  └── Components      │◄────►│  ├── /api/products           │ │
│  │  └── Contexts légers │      │  ├── /api/settings           │ │
│  │  └── Services front  │      │  ├── /api/print              │ │
│  │                      │  WS  │  └── /ws/events              │ │
│  │                      │◄────►│                              │ │
│  │                      │      │  better-sqlite3              │ │
│  │                      │      │  └── database.db             │ │
│  │                      │      │                              │ │
│  │                      │      │  SyncService                 │ │
│  │                      │      │  └── (interface branchable)  │ │
│  └──────────────────────┘      └──────────────┬───────────────┘ │
│                                               │                 │
└───────────────────────────────────────────────┼─────────────────┘
                                                │
                    ┌───────────────────────────┤
                    │                           │
                    ▼                           ▼
          PrintDaemon C#                VPS (plus tard)
          Microservice                  └── Fastify
          └── TCP/IP :9100              └── PostgreSQL/MariaDB
          └── USB                            └── Panel admin
          └── Bluetooth                      └── Site web
          └── Toute impression               └── Écran salle externe
```
