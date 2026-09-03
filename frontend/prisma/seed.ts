import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface CourseDef {
  code: string
  title: string
  credits: number
  modules: Array<{
    moduleNo: number
    name: string
    topics: string[]
  }>
}

const officialTheoryCourses: CourseDef[] = [
  // ==========================================
  // DISCIPLINE CORE — COMPUTING & ELECTRONICS
  // ==========================================
  {
    code: 'BCSE202L',
    title: 'Data Structures and Algorithms',
    credits: 3,
    modules: [
      { moduleNo: 1, name: 'Algorithm Analysis', topics: ['Fundamentals of algorithm analysis', 'Space and time complexity', 'Asymptotic notations and orders of growth', 'Best, worst, and average case', 'Recurrence relations: Iteration, Substitution, Master, and Recursion Tree methods'] },
      { moduleNo: 2, name: 'Linear Data Structures', topics: ['Arrays: 1D and 2D', 'Stack: Expression evaluation, Infix to postfix and prefix conversion, Tower of Hanoi', 'Queue: Circular queue, Double Ended Queue (deQueue)', 'Singly linked lists', 'Doubly linked lists', 'Circular linked lists', 'Polynomial manipulation'] },
      { moduleNo: 3, name: 'Searching and Sorting', topics: ['Linear search and binary search', 'Insertion sort', 'Selection sort', 'Bubble sort', 'Counting sort', 'Quick sort', 'Merge sort', 'Analysis of sorting algorithms'] },
      { moduleNo: 4, name: 'Trees', topics: ['Binary tree definition and properties', 'Tree traversals', 'Expression trees', 'Binary Search Trees (BST)', 'BST operations: Insertion, Deletion, Min and Max, kth minimum element'] },
      { moduleNo: 5, name: 'Graphs', topics: ['Graph representation', 'Breadth First Search (BFS)', 'Depth First Search (DFS)', 'Minimum Spanning Trees: Prim and Kruskal algorithms', 'Single Source Shortest Path: Dijkstra algorithm'] },
      { moduleNo: 6, name: 'Hashing', topics: ['Hash functions', 'Separate chaining', 'Open hashing: Linear, Quadratic, and Double hashing', 'Closed hashing', 'Random probing', 'Rehashing', 'Extendible hashing'] },
      { moduleNo: 7, name: 'Heaps and AVL Trees', topics: ['Heaps and Heap sort', 'Priority queues using heaps', 'AVL trees: Rotations, Insertion, and Deletion'] },
      { moduleNo: 8, name: 'Contemporary Issues', topics: ['Real-world algorithmic applications and case studies'] }
    ]
  },
  {
    code: 'BCSE204L',
    title: 'Design and Analysis of Algorithms',
    credits: 3,
    modules: [
      { moduleNo: 1, name: 'Design Paradigms: Greedy, Divide and Conquer', topics: ['Stages of algorithm development', 'Time complexity proof', 'Greedy: Fractional Knapsack, Huffman coding', 'Divide and Conquer: Maximum Subarray, Karatsuba integer multiplication'] },
      { moduleNo: 2, name: 'Dynamic Programming, Backtracking, Branch & Bound', topics: ['Assembly Line Scheduling', 'Matrix Chain Multiplication', 'Longest Common Subsequence (LCS)', '0/1 Knapsack', 'Travelling Salesperson Problem', 'N-Queens Problem', 'Subset Sum', 'Graph Coloring', 'LIFO and FIFO Branch and Bound'] },
      { moduleNo: 3, name: 'String Matching Algorithms', topics: ['Naive string matching', 'KMP algorithm', 'Rabin-Karp algorithm', 'Suffix trees'] },
      { moduleNo: 4, name: 'Graph Algorithms', topics: ['All-pair shortest path: Bellman-Ford, Floyd-Warshall', 'Network flows: Ford-Fulkerson, Edmond-Karp, Push-relabel algorithm', 'Maximum matching'] },
      { moduleNo: 5, name: 'Geometric Algorithms', topics: ['Line segment properties and intersection', 'Sweeping lines', 'Convex Hull algorithms: Graham scan, Jarvis march'] },
      { moduleNo: 6, name: 'Randomized Algorithms', topics: ['Randomized quicksort', 'Hiring problem', 'Global Minimum Cut'] },
      { moduleNo: 7, name: 'Complexity Classes and Approximation', topics: ['Class P and Class NP', 'Reducibility and NP-completeness', '3SAT', 'Independent Set', 'Clique', 'Vertex Cover', 'Set Cover'] },
      { moduleNo: 8, name: 'Contemporary Issues', topics: ['Recent developments in algorithmic efficiency'] }
    ]
  },
  {
    code: 'BCSE205L',
    title: 'Computer Architecture and Organization',
    credits: 3,
    modules: [
      { moduleNo: 1, name: 'Introduction to CAO', topics: ['Overview of Organization and Architecture', 'Functional components of a computer', 'Registers and register files', 'IAS computer function', 'Von Neumann machine', 'Harvard architecture', 'CISC and RISC architectures'] },
      { moduleNo: 2, name: 'Data Representation and Computer Arithmetic', topics: ['Fixed-point arithmetic: Booth and Modified Booth multiplication', 'Restoring and non-restoring division', 'Floating-point arithmetic (IEEE 754)', 'Character codes'] },
      { moduleNo: 3, name: 'Instruction Sets and Control Unit', topics: ['Instruction formats and addressing modes', 'Instruction cycle phases', 'ALU design', 'Hardwired and Micro-programmed control units', 'Execution time, MIPS, MFLOPS'] },
      { moduleNo: 4, name: 'Memory System Organization and Architecture', topics: ['Memory hierarchy', 'RAM and ROM chips', 'Memory interleaving', 'Cache memory principles', 'Cache mapping techniques', 'Cache replacement policies', 'Virtual memory and TLB'] },
      { moduleNo: 5, name: 'Interfacing and Communication', topics: ['I/O fundamentals', 'Programmed I/O', 'Interrupt-driven I/O', 'Direct Memory Access (DMA)', 'Direct Cache Access', 'Bus arbitration'] },
      { moduleNo: 6, name: 'Subsystems', topics: ['Solid state drives', 'Disk drive organization', 'RAID levels', 'Error detecting and correcting systems'] },
      { moduleNo: 7, name: 'High Performance Processors', topics: ['Flynn taxonomy (SISD, SIMD, MISD, MIMD)', 'Pipelining stages and hazards', 'Branch prediction', 'Superscalar architecture', 'Amdahl law'] },
      { moduleNo: 8, name: 'Contemporary Issues', topics: ['Emerging trends in multicore and processor design'] }
    ]
  },
  {
    code: 'BCSE301L',
    title: 'Software Engineering',
    credits: 3,
    modules: [
      { moduleNo: 1, name: 'Overview of Software Engineering', topics: ['Nature of Software', 'Software processes', 'Classical evolutionary models', 'Agile methodologies', 'Scrum framework', 'Extreme programming (XP)'] },
      { moduleNo: 2, name: 'Software Project Management', topics: ['Scope and Work Breakdown Structure (WBS)', 'Milestones and deliverables', 'Cost estimation', 'Risk management and RMMM plan', 'CASE tools', 'Metrics and measurement'] },
      { moduleNo: 3, name: 'Modelling Requirements', topics: ['Functional and non-functional requirements', 'Requirements elicitation', 'System modeling', 'SRS specification and validation', 'Agile requirements management'] },
      { moduleNo: 4, name: 'Software Design', topics: ['Design concepts: Abstraction, Refinement, Modularity, Cohesion and Coupling', 'Architectural design', 'Refactoring of designs', 'Object-oriented UI design'] },
      { moduleNo: 5, name: 'Validation and Verification', topics: ['Software testing fundamentals', 'Test plan and test design', 'Unit, Integration, and Regression testing', 'Mutation testing', 'DevOps and CI/CD testing'] },
      { moduleNo: 6, name: 'Software Evolution', topics: ['Software maintenance types', 'Software configuration management (SCM)', 'Re-engineering and reverse engineering', 'Software reuse'] },
      { moduleNo: 7, name: 'Quality Assurance', topics: ['Product and process metrics', 'ISO and CMMI quality standards', 'Six-Sigma', 'SQA management factors'] },
      { moduleNo: 8, name: 'Contemporary Issues', topics: ['Industry software engineering practices'] }
    ]
  },
  {
    code: 'BCSE302L',
    title: 'Database Systems',
    credits: 3,
    modules: [
      { moduleNo: 1, name: 'Database Concepts and Architecture', topics: ['Need for DBMS', 'DBMS characteristics and advantages', 'Database Administrator role', 'Schemas and instances', 'Three-Schema architecture', 'Centralized and Client/Server DBMS'] },
      { moduleNo: 2, name: 'Relational Model and E-R Modeling', topics: ['Candidate keys, Primary keys, Foreign keys', 'Integrity constraints', 'ER Model: Attributes, Relationships, Structural constraints', 'ER to relational schema mapping', 'Extended ER: Generalization and Specialization'] },
      { moduleNo: 3, name: 'Relational Database Design', topics: ['Functional dependencies and axioms', 'Normalization: 1NF, 2NF, 3NF, BCNF, 4NF, 5NF', 'Join dependencies'] },
      { moduleNo: 4, name: 'Physical Database Design and Query Processing', topics: ['File organization', 'Single-level and multi-level indexing', 'B+ Tree indexing', 'Static and Dynamic hashing', 'Relational algebra', 'Query processing and optimization', 'Tuple relational calculus'] },
      { moduleNo: 5, name: 'Transaction Processing and Recovery', topics: ['ACID properties', 'Transaction states', 'Serial and serializable schedules', 'Conflict serializability', 'Log-based recovery', 'Shadow paging'] },
      { moduleNo: 6, name: 'Concurrency Control', topics: ['Lost update problem', 'Timestamp-based protocols', 'Thomas write rule', 'Two-Phase Locking (2PL)', 'Graph-based protocols', 'Deadlock handling and prevention', 'Multi-granularity locking'] },
      { moduleNo: 7, name: 'NoSQL Database Management', topics: ['Need for NoSQL', 'CAP theorem', 'Key-value stores', 'Columnar families', 'Document databases', 'Graph databases'] },
      { moduleNo: 8, name: 'Contemporary Issues', topics: ['Cloud database architectures and modern data warehouses'] }
    ]
  },
  {
    code: 'BCSE303L',
    title: 'Operating Systems',
    credits: 3,
    modules: [
      { moduleNo: 1, name: 'Introduction to OS', topics: ['OS functionality', 'Design issues', 'Monolithic, Layered, and Micro-kernel structures', 'Processes, resources, and security influences'] },
      { moduleNo: 2, name: 'OS Principles', topics: ['System calls and application interface', 'User/Kernel modes', 'Interrupts', 'Process Control Block (PCB)', 'Process creation in Unix', 'User-level and kernel-level threads'] },
      { moduleNo: 3, name: 'Scheduling', topics: ['Pre-emptive and non-pre-emptive scheduling', 'Multiprocessor scheduling', 'Deadlock prevention, avoidance (Banker algorithm), detection, and recovery'] },
      { moduleNo: 4, name: 'Concurrency', topics: ['Inter-process communication (IPC)', 'Synchronization primitives: Peterson solution, Semaphores', 'Monitors and Dining Philosophers problem', 'Lock-free coordination'] },
      { moduleNo: 5, name: 'Memory Management', topics: ['Paging and segmentation', 'Hardware support: TLB', 'Virtual memory and demand paging', 'Page replacement algorithms (FIFO, LRU)', 'Thrashing'] },
      { moduleNo: 6, name: 'Virtualization and File System Management', topics: ['Virtual machines and hypervisors', 'Containers', 'File allocation methods', 'Directory implementations', 'Journaling and log-structured file systems'] },
      { moduleNo: 7, name: 'Storage Management, Protection and Security', topics: ['Disk scheduling algorithms', 'RAID levels', 'Access matrices', 'Authentication mechanisms'] },
      { moduleNo: 8, name: 'Contemporary Issues', topics: ['Mobile and distributed operating systems'] }
    ]
  },
  {
    code: 'BCSE304L',
    title: 'Theory of Computation',
    credits: 3,
    modules: [
      { moduleNo: 1, name: 'Languages and Grammars', topics: ['Mathematical proof techniques', 'Computational models', 'Alphabets and strings', 'Operations on languages', 'Automata overview'] },
      { moduleNo: 2, name: 'Finite State Automata', topics: ['Deterministic Finite Automata (DFA)', 'Non-deterministic Finite Automata (NFA)', 'NFA with epsilon transitions', 'NFA to DFA conversion', 'DFA minimization'] },
      { moduleNo: 3, name: 'Regular Expressions and Languages', topics: ['FA to regular expressions conversion', 'Pattern matching', 'Regular grammar', 'Pumping Lemma for regular languages', 'Closure properties'] },
      { moduleNo: 4, name: 'Context Free Grammars', topics: ['CFG derivations and parse trees', 'Ambiguity in CFG', 'CYK algorithm', 'Chomsky Normal Form (CNF)', 'Greibach Normal Form (GNF)', 'Pumping Lemma for CFL'] },
      { moduleNo: 5, name: 'Pushdown Automata', topics: ['Pushdown Automata (PDA) definition', 'Deterministic vs Non-deterministic PDA', 'Equivalence with CFG'] },
      { moduleNo: 6, name: 'Turing Machines', topics: ['Turing Machine model', 'Acceptors and transducers', 'Universal Turing Machine', 'Halting Problem', 'Church-Turing thesis'] },
      { moduleNo: 7, name: 'Recursive and RE Languages', topics: ['Chomsky hierarchy', 'Recursive vs Recursively Enumerable languages', 'Computable functions', 'Undecidable problems', 'Post Correspondence Problem (PCP)'] },
      { moduleNo: 8, name: 'Contemporary Issues', topics: ['Modern computational complexity frontiers'] }
    ]
  },
  {
    code: 'BCSE307L',
    title: 'Compiler Design',
    credits: 3,
    modules: [
      { moduleNo: 1, name: 'Compilation and Lexical Analysis', topics: ['Compiler structure and phases', 'Lexemes, tokens, and patterns', 'Regular expressions to DFA', 'Lex/Flex analyzer generators'] },
      { moduleNo: 2, name: 'Syntax Analysis', topics: ['Parser role and parse trees', 'Top-down parsing: LL(1)', 'Recursive descent parsing', 'Bottom-up parsing: Shift-reduce, Operator precedence, SLR, CLR, LALR tables'] },
      { moduleNo: 3, name: 'Semantics Analysis', topics: ['Syntax Directed Definition (SDD)', 'Syntax Directed Translation Schemes', 'L-attributed definitions'] },
      { moduleNo: 4, name: 'Intermediate Code Generation', topics: ['Three-Address Code', 'Syntax tree variants', 'Declarations and procedures', 'Backpatching and switch-case translation'] },
      { moduleNo: 5, name: 'Code Optimization', topics: ['Data flow analysis', 'Basic blocks and flow graphs', 'Peephole optimization', 'DAG representation', 'Loop optimizations'] },
      { moduleNo: 6, name: 'Code Generation', topics: ['Target machine issues', 'Next-use information', 'Register allocation and assignment', 'Activation records'] },
      { moduleNo: 7, name: 'Parallelism', topics: ['Automatic parallelization', 'Optimizations for cache locality', 'Vectorization', 'Software pipelining', 'Static Single Assignment (SSA)'] },
      { moduleNo: 8, name: 'Contemporary Issues', topics: ['Modern JIT compilers and LLVM infrastructure'] }
    ]
  },
  {
    code: 'BCSE308L',
    title: 'Computer Networks',
    credits: 3,
    modules: [
      { moduleNo: 1, name: 'Networking Principles & Layered Architecture', topics: ['OSI and TCP/IP reference models', 'Network topologies', 'Protocols and standards', 'Data flow'] },
      { moduleNo: 2, name: 'Circuit and Packet Switching', topics: ['Switched communication networks', 'Circuit switching vs packet switching', 'Transmission impairments', 'Bandwidth and delay'] },
      { moduleNo: 3, name: 'Data Link Layer', topics: ['Error detection and correction: Hamming code, CRC', 'Sliding Window protocols (Go-Back-N, Selective Repeat)', 'MAC protocols: Slotted Aloha, CSMA/CD, Ethernet (IEEE 802.3), WiFi (802.11)'] },
      { moduleNo: 4, name: 'Network Layer', topics: ['IPv4 and IPv6 addressing', 'Classless addressing and subnetting', 'Network Address Translation (NAT)', 'Header formats'] },
      { moduleNo: 5, name: 'Routing Protocols', topics: ['Distance Vector and Link State routing', 'Routing protocols implementation and performance analysis'] },
      { moduleNo: 6, name: 'Transport Layer', topics: ['TCP vs UDP', 'Congestion control algorithms', 'Three-way handshake', 'Flow control and window management', 'QoS parameters'] },
      { moduleNo: 7, name: 'Application Layer', topics: ['Domain Name System (DNS)', 'HTTP and HTTPS', 'FTP', 'SMTP and email architecture', 'SNMP'] },
      { moduleNo: 8, name: 'Contemporary Issues', topics: ['Software-Defined Networking (SDN) and modern network protocols'] }
    ]
  },
  {
    code: 'BECE102L',
    title: 'Digital Systems Design',
    credits: 3,
    modules: [
      { moduleNo: 1, name: 'Digital Logic', topics: ['Boolean algebra theorems', 'Canonical standard forms', 'K-maps (up to 4 variables)', 'NAND/NOR implementations', 'TTL and CMOS logic families'] },
      { moduleNo: 2, name: 'Verilog HDL', topics: ['Lexical conventions', 'Ports and modules', 'Dataflow modeling', 'Gate-level and behavioral modeling', 'Testbenches'] },
      { moduleNo: 3, name: 'Design of Combinational Logic Circuits', topics: ['Adders and Subtractors', 'Decoders and Encoders', 'Multiplexers and De-multiplexers', 'Parity generators and checkers', 'Verilog modeling of combinational circuits'] },
      { moduleNo: 4, name: 'Design of Data Path Circuits', topics: ['N-bit parallel adder/subtractor', 'Carry look-ahead adder', 'Array multiplier and Booth multiplier', 'Magnitude comparators'] },
      { moduleNo: 5, name: 'Design of Sequential Logic Circuits', topics: ['Latches and Flip-flops (SR, D, JK, T)', 'Shift registers (SISO, SIPO, PISO, PIPO)', 'Synchronous and asynchronous counters'] },
      { moduleNo: 6, name: 'Design of FSM', topics: ['Mealy and Moore state machines', 'Sequence detection design', 'Verilog modeling of FSM'] },
      { moduleNo: 7, name: 'Programmable Logic Devices', topics: ['PLA, PAL, CPLD architectures', 'FPGA generic architecture'] },
      { moduleNo: 8, name: 'Contemporary Issues', topics: ['Recent advances in digital system design'] }
    ]
  },
  {
    code: 'BECE204L',
    title: 'Microprocessors and Microcontrollers',
    credits: 3,
    modules: [
      { moduleNo: 1, name: 'Overview of Microprocessors', topics: ['Microprocessor introduction', '8-bit and 16-bit architectures', 'Intel Pentium series'] },
      { moduleNo: 2, name: 'Microprocessor Architecture & Interfacing: Intel x86', topics: ['Intel 8086 architecture and addressing modes', 'Memory segmentation', 'Assembly language programming with DOS/BIOS calls', '8255 Programmable Peripheral Interface', '8254 Timer'] },
      { moduleNo: 3, name: 'Microcontroller Architecture: Intel 8051', topics: ['8051 organization and architecture', 'RAM/ROM organization', 'Instruction set and addressing modes', 'Assembly programming'] },
      { moduleNo: 4, name: 'Microcontroller 8051 Peripherals', topics: ['I/O ports', 'Timers and Counters', 'Serial communication', 'Interrupt handling'] },
      { moduleNo: 5, name: 'I/O Interfacing with 8051', topics: ['LCD and LED interfacing', 'Keypad', 'ADC and DAC interfacing', 'Sensors and signal conditioning'] },
      { moduleNo: 6, name: 'ARM Processor Architecture', topics: ['ARM design philosophy', 'ARM architecture overview', 'Registers and processor modes', 'Pipelining and vector tables'] },
      { moduleNo: 7, name: 'ARM Instruction Set', topics: ['Data processing instructions', 'Branch instructions', 'Load/store instructions', 'Assembly programming on ARM'] },
      { moduleNo: 8, name: 'Contemporary Issues', topics: ['Modern embedded processor ecosystems'] }
    ]
  },
  {
    code: 'BECE206L',
    title: 'Analog Circuits',
    credits: 3,
    modules: [
      { moduleNo: 1, name: 'DC and AC Analysis of Amplifiers', topics: ['BJT circuits: DC biasing, small-signal analysis, frequency response', 'MOSFET circuits: Biasing, small-signal CS amplifier', 'Miller capacitance'] },
      { moduleNo: 2, name: 'MOSFET Power Amplifiers', topics: ['Power transistors', 'Class A, Class B, and Class AB push-pull output stages'] },
      { moduleNo: 3, name: 'MOSFET Active Biasing & Differential Amplifiers', topics: ['Current mirror: Basic, Wilson, Cascode', 'MOSFET differential pair', 'Large and small signal analysis'] },
      { moduleNo: 4, name: 'Operational Amplifier Characteristics & Applications', topics: ['Ideal and non-ideal Op-Amp', 'Negative feedback amplifiers', 'Summing, scaling, integrator, differentiator, instrumentation amplifiers'] },
      { moduleNo: 5, name: 'Comparators and Waveform Generators', topics: ['Schmitt trigger', 'Astable and monostable multivibrators', 'Barkhausen criterion', 'Phase-shift and Wien-bridge oscillators'] },
      { moduleNo: 6, name: 'Active Filters and Data Converters', topics: ['Low-pass, high-pass, and band-pass filters', 'Sample-and-hold circuits', 'DAC and ADC techniques'] },
      { moduleNo: 7, name: 'Special Function ICs', topics: ['IC 555 timer and applications', 'Voltage regulators: LM317'] },
      { moduleNo: 8, name: 'Contemporary Issues', topics: ['Analog IC trends'] }
    ]
  },
  {
    code: 'BECE303L',
    title: 'VLSI System Design',
    credits: 3,
    modules: [
      { moduleNo: 1, name: 'VLSI Design Overview and MOSFET Theory', topics: ['VLSI design flow', 'Regularity, modularity, locality', 'MOSFET device structure', 'Capacitance-voltage characteristics', 'Scaling effects'] },
      { moduleNo: 2, name: 'CMOS Logic Gates', topics: ['CMOS inverter DC transfer characteristics', 'Static and dynamic behavior', 'Basic and compound gates', 'Latches and flip-flops'] },
      { moduleNo: 3, name: 'CMOS Fabrication and Layout', topics: ['N-well and P-well CMOS processes', 'Latch-up in CMOS', 'Stick diagrams using Euler theorem', 'Layout design rules'] },
      { moduleNo: 4, name: 'CMOS Circuits Performance Analysis', topics: ['Delay estimation and logical effort', 'Transistor sizing', 'Static and dynamic power dissipation'] },
      { moduleNo: 5, name: 'CMOS Logic Families', topics: ['Pass transistor logic', 'Transmission gates', 'Pseudo-NMOS', 'Dynamic and domino logic', 'Clocked CMOS (C2MOS)'] },
      { moduleNo: 6, name: 'Timing Analysis', topics: ['Static timing analysis (STA)', 'Setup time and hold time', 'Critical path calculation', 'Slack and timing violations'] },
      { moduleNo: 7, name: 'Semiconductor Memory Design', topics: ['ROM circuits', 'SRAM and DRAM cell design and operation'] },
      { moduleNo: 8, name: 'Contemporary Issues', topics: ['Sub-micron technologies and modern EDA tools'] }
    ]
  },
  {
    code: 'BECE309L',
    title: 'Artificial Intelligence and Machine Learning',
    credits: 3,
    modules: [
      { moduleNo: 1, name: 'Foundations of AI', topics: ['Intelligent agents and rationality', 'Task environments', 'Agent architecture types'] },
      { moduleNo: 2, name: 'Problem-solving by Searching', topics: ['Search space representation', 'Uninformed and informed search strategies', 'Complex environments'] },
      { moduleNo: 3, name: 'Knowledge Representation', topics: ['Knowledge-based agents', 'Propositional logic', 'First-order logic'] },
      { moduleNo: 4, name: 'Probability Reasoning and Uncertainty', topics: ['Quantifying uncertainty', 'Bayesian decision making'] },
      { moduleNo: 5, name: 'Data Preparation for Machine Learning', topics: ['Vectors and matrices in ML', 'Data cleaning, integration, transformation, reduction'] },
      { moduleNo: 6, name: 'Learning from Examples', topics: ['Supervised learning', 'Regression', 'Naive Bayes, Decision Trees, Random Forest', 'Clustering and ensemble learning'] },
      { moduleNo: 7, name: 'Deep Learning', topics: ['Feedforward networks', 'Computational graphs', 'Convolutional networks (CNN)', 'Recurrent networks (RNN)'] },
      { moduleNo: 8, name: 'Contemporary Issues', topics: ['Ethical and practical AI deployments'] }
    ]
  },
  {
    code: 'BECE411L',
    title: 'Cryptography and Network Security',
    credits: 3,
    modules: [
      { moduleNo: 1, name: 'Cryptography Overview', topics: ['OSI security architecture', 'Security attacks, services, and mechanisms', 'Classical encryption techniques'] },
      { moduleNo: 2, name: 'Mathematical Foundations', topics: ['Number theory and finite fields', 'Fermat and Euler theorems', 'Chinese Remainder Theorem', 'Fast exponentiation', 'Discrete logarithms'] },
      { moduleNo: 3, name: 'Symmetric Ciphers', topics: ['Block and stream ciphers', 'DES, IDEA, AES algorithms', 'Diffie-Hellman Key Exchange'] },
      { moduleNo: 4, name: 'Asymmetric Ciphers', topics: ['RSA cryptosystem', 'ElGamal cryptosystem', 'RABIN cryptosystem', 'Elliptic Curve Cryptography'] },
      { moduleNo: 5, name: 'Data Integrity Algorithms', topics: ['Cryptographic hash functions: MD4, SHA-512', 'HMAC', 'Digital signatures: RSA, ElGamal, DSS'] },
      { moduleNo: 6, name: 'Mutual Trust', topics: ['Key management and distribution', 'X.509 certificates', 'Kerberos protocol'] },
      { moduleNo: 7, name: 'Network and Internet Security', topics: ['TLS and SSL', 'Wireless LAN security', 'Firewalls and intrusion detection', 'IoT security threats'] },
      { moduleNo: 8, name: 'Contemporary Issues', topics: ['Post-quantum cryptography and blockchain security'] }
    ]
  },
  {
    code: 'BECE355L',
    title: 'AWS for Cloud Computing',
    credits: 3,
    modules: [
      { moduleNo: 1, name: 'AWS Cloud Concepts', topics: ['Cloud service models (IaaS, PaaS, SaaS)', 'AWS global infrastructure', 'AWS Shared Responsibility Model'] },
      { moduleNo: 2, name: 'AWS Core Services', topics: ['Amazon EC2 (Compute)', 'Amazon S3 (Storage)', 'Amazon RDS (Database)', 'Amazon VPC (Networking)', 'Amazon SQS and SNS (Messaging)'] },
      { moduleNo: 3, name: 'AWS Database & Serverless Services', topics: ['AWS Lambda', 'Amazon DynamoDB', 'Amazon ECS', 'Amazon S3 Glacier', 'Disaster recovery on AWS'] },
      { moduleNo: 4, name: 'AWS Security and Compliance', topics: ['AWS IAM', 'KMS encryption', 'AWS Inspector', 'AWS Trusted Advisor'] },
      { moduleNo: 5, name: 'AWS Architectural Best Practices', topics: ['AWS Well-Architected Framework', 'Scalability and elasticity', 'High availability and fault tolerance', 'Cost optimization'] },
      { moduleNo: 6, name: 'AWS Operational Excellence', topics: ['AWS Management Console', 'AWS CLI', 'AWS SDKs', 'CloudFormation', 'CloudWatch'] },
      { moduleNo: 7, name: 'AWS Networking and Content Delivery', topics: ['Route 53', 'CloudFront CDN', 'API Gateway', 'AWS Direct Connect', 'VPC Peering and Transit Gateway'] },
      { moduleNo: 8, name: 'Contemporary Issues', topics: ['Enterprise cloud migration and FinOps'] }
    ]
  },

  // ==========================================
  // FOUNDATION CORE (MATHEMATICS & SCIENCES)
  // ==========================================
  {
    code: 'BPHY101L',
    title: 'Engineering Physics',
    credits: 3,
    modules: [
      { moduleNo: 1, name: 'Introduction to Waves', topics: ['Wave equation on a string', 'Harmonic waves and boundaries', 'Standing waves and eigenfrequencies', 'Wave packets', 'Phase velocity and group velocity'] },
      { moduleNo: 2, name: 'Electromagnetic Waves', topics: ['Divergence, gradient, and curl', 'Maxwell equations', 'Displacement current', 'EM wave equation in free space', 'Hertz experiment'] },
      { moduleNo: 3, name: 'Elements of Quantum Mechanics', topics: ['Quantization idea', 'Compton effect', 'de Broglie hypothesis', 'Davisson-Germer experiment', 'Heisenberg uncertainty principle', 'Schrodinger wave equation'] },
      { moduleNo: 4, name: 'Applications of Quantum Mechanics', topics: ['Particle in 1D box', 'Nanophysics basics', 'Quantum confinement', 'Tunneling effect'] },
      { moduleNo: 5, name: 'Lasers', topics: ['Spatial and temporal coherence', 'Einstein coefficients', 'Population inversion', 'He-Ne, Nd:YAG, CO2 lasers'] },
      { moduleNo: 6, name: 'Propagation of EM Waves in Optical Fibers', topics: ['Light propagation in fibers', 'Numerical aperture and acceptance angle', 'V-parameter', 'Attenuation and dispersion'] },
      { moduleNo: 7, name: 'Optoelectronic Devices', topics: ['Direct and indirect bandgap semiconductors', 'LEDs', 'Laser diodes', 'Photodetectors: PN and PIN'] },
      { moduleNo: 8, name: 'Contemporary Topics', topics: ['Recent research in optoelectronics and photonics'] }
    ]
  },
  {
    code: 'BCHY101L',
    title: 'Engineering Chemistry',
    credits: 3,
    modules: [
      { moduleNo: 1, name: 'Chemical Thermodynamics and Kinetics', topics: ['Entropy change and spontaneity', 'Gibbs free energy', 'Activation energy and Arrhenius equation', 'Catalysis and Michaelis-Menten mechanism'] },
      { moduleNo: 2, name: 'Metal Complexes and Organometallics', topics: ['Inorganic complexes bonding', 'Metal carbonyls', 'Ferrocene', 'Grignard reagents', 'Metals in biology: Hemoglobin and chlorophyll'] },
      { moduleNo: 3, name: 'Organic Intermediates & Reactions', topics: ['Carbocations, carbanions, radicals', 'Aromaticity and heterocycles', 'Drug and dye organic transformations'] },
      { moduleNo: 4, name: 'Energy Devices', topics: ['Electrochemical cells', 'Li-ion secondary batteries', 'Supercapacitors', 'Fuel cells (H2-O2, SOFC)', 'Photovoltaic and dye-sensitized solar cells'] },
      { moduleNo: 5, name: 'Functional Materials', topics: ['Oxides (AB, AB2, ABO3)', 'Polymers (Teflon, Bakelite)', 'Conducting polymers and OLEDs', 'Nanomaterials: synthesis and properties'] },
      { moduleNo: 6, name: 'Spectroscopic & Microscopic Techniques', topics: ['UV-Visible spectroscopy', 'XRD techniques', 'AAS, IR, NMR, SEM, TEM overview'] },
      { moduleNo: 7, name: 'Industrial Applications', topics: ['Water purification: Zeolites, ion-exchange, reverse osmosis', 'Fuels and combustion', 'Corrosion control and cathodic protection', 'Chemical sensors'] },
      { moduleNo: 8, name: 'Contemporary Topics', topics: ['Green chemistry and sustainability'] }
    ]
  },
  {
    code: 'BMAT101L',
    title: 'Calculus',
    credits: 3,
    modules: [
      { moduleNo: 1, name: 'Single Variable Calculus', topics: ['Differentiation and extrema', 'Rolle theorem and Mean Value theorem', 'First and second derivative tests', 'Area between curves', 'Volumes of revolution'] },
      { moduleNo: 2, name: 'Multivariable Calculus', topics: ['Functions of two variables', 'Partial derivatives', 'Total differential', 'Jacobian and its properties'] },
      { moduleNo: 3, name: 'Application of Multivariable Calculus', topics: ['Taylor expansion for two variables', 'Constrained maxima and minima', 'Lagrange multiplier method'] },
      { moduleNo: 4, name: 'Multiple Integrals', topics: ['Double integrals evaluation', 'Change of order of integration', 'Change of variables to polar coordinates', 'Triple integrals evaluation'] },
      { moduleNo: 5, name: 'Special Functions', topics: ['Beta and Gamma functions', 'Evaluation of multiple integrals using gamma/beta', 'Dirichlet integral', 'Error functions'] },
      { moduleNo: 6, name: 'Vector Differentiation', topics: ['Scalar and vector valued functions', 'Gradient, Tangent plane', 'Directional derivative', 'Divergence and curl', 'Scalar and vector potentials'] },
      { moduleNo: 7, name: 'Vector Integration', topics: ['Line, surface, and volume integrals', 'Green theorem', 'Stokes theorem', 'Gauss Divergence theorem'] },
      { moduleNo: 8, name: 'Contemporary Topics', topics: ['Computational calculus applications'] }
    ]
  },
  {
    code: 'BMAT102L',
    title: 'Differential Equations and Transforms',
    credits: 4,
    modules: [
      { moduleNo: 1, name: 'Ordinary Differential Equations (ODE)', topics: ['Second order non-homogeneous differential equations', 'Method of undetermined coefficients', 'Variation of parameters', 'Damped forced oscillations'] },
      { moduleNo: 2, name: 'Partial Differential Equations (PDE)', topics: ['Formation of PDE', 'Singular integrals', 'First order PDE standard types', 'Lagrange linear equation', 'Separation of variables'] },
      { moduleNo: 3, name: 'Laplace Transform', topics: ['Laplace transform definition and properties', 'Transform of periodic functions', 'Unit step and impulse functions', 'Inverse Laplace transform', 'Convolution theorem'] },
      { moduleNo: 4, name: 'Solution to ODE and PDE by Laplace Transform', topics: ['Solving differential equations with Heaviside/impulse inputs', 'Solving non-homogeneous systems', 'First order PDE solutions'] },
      { moduleNo: 5, name: 'Fourier Series', topics: ['Euler formulae', 'Dirichlet conditions', 'Half range series', 'RMS value', 'Parseval identity'] },
      { moduleNo: 6, name: 'Fourier Transform', topics: ['Complex Fourier transform', 'Fourier sine and cosine transforms', 'Convolution theorem in PDEs'] },
      { moduleNo: 7, name: 'Z-Transform', topics: ['Z-transform definition and properties', 'Inverse Z-transform', 'Difference equations with constant coefficients', 'Applications in digital signal processing'] },
      { moduleNo: 8, name: 'Contemporary Issues', topics: ['Numerical solutions of complex transforms'] }
    ]
  },
  {
    code: 'BMAT201L',
    title: 'Complex Variables and Linear Algebra',
    credits: 4,
    modules: [
      { moduleNo: 1, name: 'Analytic Functions', topics: ['Cauchy-Riemann equations', 'Harmonic functions and conjugates', 'Potential of fluid flow and electric field'] },
      { moduleNo: 2, name: 'Conformal and Bilinear Transformations', topics: ['Elementary conformal mappings', 'Bilinear transformation', 'Cross-ratio preservation'] },
      { moduleNo: 3, name: 'Complex Integration', topics: ['Taylor and Laurent series', 'Singularities, poles, and residues', 'Cauchy-Goursat theorem', 'Cauchy integral formula', 'Residue theorem'] },
      { moduleNo: 4, name: 'Vector Spaces', topics: ['Subspaces, linear combinations, span', 'Linear dependence and independence', 'Bases and dimensions', 'Row and column spaces', 'Rank and nullity'] },
      { moduleNo: 5, name: 'Linear Transformations', topics: ['Linear transformation matrices', 'Invertible transformations', 'Change of bases', 'Similarity'] },
      { moduleNo: 6, name: 'Inner Product Spaces', topics: ['Dot products and inner products', 'Vector norms and angles', 'Gram-Schmidt Orthogonalization'] },
      { moduleNo: 7, name: 'Matrices and System of Equations', topics: ['Eigenvalues and eigenvectors', 'Cayley-Hamilton theorem', 'System of linear equations', 'Gaussian elimination and Gauss-Jordan methods'] },
      { moduleNo: 8, name: 'Contemporary Issues', topics: ['Modern linear algebra in data science and computer graphics'] }
    ]
  },
  {
    code: 'BMAT202L',
    title: 'Probability and Statistics',
    credits: 3,
    modules: [
      { moduleNo: 1, name: 'Introduction to Statistics', topics: ['Measures of central tendency', 'Measures of dispersion', 'Moments, skewness, and kurtosis'] },
      { moduleNo: 2, name: 'Random Variables', topics: ['Probability mass and density functions', 'Joint probability distributions', 'Marginal and conditional distributions', 'Mathematical expectation', 'Covariance and MGF'] },
      { moduleNo: 3, name: 'Correlation and Regression', topics: ['Rank correlation', 'Partial and multiple correlation', 'Multiple linear regression models'] },
      { moduleNo: 4, name: 'Probability Distributions', topics: ['Binomial distribution', 'Poisson distribution', 'Normal distribution', 'Gamma, Exponential, and Weibull distributions'] },
      { moduleNo: 5, name: 'Hypothesis Testing-I (Large Samples)', topics: ['Type-I and Type-II errors', 'Critical regions', 'Z-tests for single proportion and difference of proportions', 'Z-tests for means'] },
      { moduleNo: 6, name: 'Hypothesis Testing-II (Small Samples & ANOVA)', topics: ['Student t-test', 'F-test', 'Chi-square test of goodness of fit and independence', 'Analysis of Variance (ANOVA): One-way, Two-way, CRD, RBD, LSD'] },
      { moduleNo: 7, name: 'Reliability', topics: ['Hazard function', 'Reliability of series and parallel systems', 'System availability and maintainability'] },
      { moduleNo: 8, name: 'Contemporary Issues', topics: ['Statistical machine learning and empirical data analysis'] }
    ]
  },
  {
    code: 'BMAT205L',
    title: 'Discrete Mathematics and Graph Theory',
    credits: 4,
    modules: [
      { moduleNo: 1, name: 'Mathematical Logic', topics: ['Connectives and truth tables', 'Tautologies and equivalence', 'Normal forms (DNF, CNF)', 'Theory of inference for statement calculus', 'Predicate calculus'] },
      { moduleNo: 2, name: 'Algebraic Structures', topics: ['Semigroups and monoids', 'Groups, subgroups, and cosets', 'Lagrange theorem', 'Group homomorphisms', 'Group codes'] },
      { moduleNo: 3, name: 'Counting Techniques', topics: ['Pigeonhole principle', 'Permutations and combinations', 'Inclusion-exclusion principle', 'Recurrence relations and generating functions'] },
      { moduleNo: 4, name: 'Lattices and Boolean Algebra', topics: ['Partially ordered sets (Posets)', 'Hasse diagrams', 'Lattices as algebraic systems', 'Boolean algebra properties and functions'] },
      { moduleNo: 5, name: 'Fundamentals of Graphs', topics: ['Planar and complete graphs', 'Matrix representation of graphs', 'Graph isomorphism', 'Euler and Hamilton paths', 'Shortest path algorithms'] },
      { moduleNo: 6, name: 'Trees and Cut Sets', topics: ['Properties of trees', 'Spanning trees and algorithms', 'Tree traversals', 'Fundamental circuits and cut-sets'] },
      { moduleNo: 7, name: 'Graph Colouring and Partitioning', topics: ['Bipartite graphs', 'Chromatic number and chromatic polynomials', 'Four colour problem'] },
      { moduleNo: 8, name: 'Contemporary Issues', topics: ['Graph theoretical algorithms in computer science'] }
    ]
  }
]

async function main() {
  console.log(`\n=============================================================`)
  console.log(`Seeding authentic theory curriculum (${officialTheoryCourses.length} courses)`)
  console.log(`=============================================================`)

  for (const courseDef of officialTheoryCourses) {
    // Upsert course
    const course = await prisma.course.upsert({
      where: { code: courseDef.code },
      update: {
        title: courseDef.title,
        credits: courseDef.credits,
      },
      create: {
        code: courseDef.code,
        title: courseDef.title,
        credits: courseDef.credits,
      }
    })

    // Upsert modules and topics
    for (const m of courseDef.modules) {
      const moduleRecord = await prisma.module.upsert({
        where: {
          courseId_moduleNo: {
            courseId: course.id,
            moduleNo: m.moduleNo
          }
        },
        update: {
          name: m.name
        },
        create: {
          courseId: course.id,
          moduleNo: m.moduleNo,
          name: m.name
        }
      })

      for (const topicName of m.topics) {
        const existingTopic = await prisma.topic.findFirst({
          where: {
            moduleId: moduleRecord.id,
            topicName: topicName
          }
        })

        if (!existingTopic) {
          await prisma.topic.create({
            data: {
              moduleId: moduleRecord.id,
              topicName: topicName
            }
          })
        }
      }
    }

    console.log(`✓ Seeded ${course.code}: ${course.title} (${courseDef.modules.length} modules)`)
  }

  console.log(`\nAll official theory courses and syllabus modules seeded successfully!`)
}

main()
  .catch((e) => {
    console.error('Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
