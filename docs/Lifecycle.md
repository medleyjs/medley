# Lifecycle

Following the schema of the internal lifecycle of Fastify.<br>
On the right branch of every section there is the next phase of the lifecycle, on the left branch there is the corresponding error code that will be generated if the parent throws an error *(note that all the errors are automatically handled by Fastify)*.

```
Incoming Request
  │
  └─▶ Routing
        │
  404 ◀─┴─▶ onRequest Hook
             │
   4**/5** ◀─┴─▶ Body Parsing
                  │
            400 ◀─┴─▶ preHandler Hook
                        │
              4**/5** ◀─┴─▶ beforeHandler
                              │
                    4**/5** ◀─┴─▶ Route Handler
                                    │
                                    └─▶ Serialize Response Payload
                                          │
                                          └─▶ onSend Hook
                                                 │
                                       4**/5** ◀─┴─▶ Send Response
                                                       │
                                                       └─▶ onResponse Hook
```
