# Employee Attendance Management System

## Overview

This project contains two complete attendance management systems:

1. **Web Application**: A full-stack system built with React, Express.js, and PostgreSQL, featuring a modern UI with shadcn/ui components and Drizzle ORM for type-safe database interactions.

2. **Kotlin Desktop Application**: A complete single-file Jetpack Compose application (`main.kt`) that strictly follows the South Asia Consultancy PDF format. This standalone application includes SQLite storage, Material 3 design, and export functionality for both XLSX and PDF formats.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The client-side application is built using React with TypeScript and follows a modern component-based architecture:

- **UI Framework**: React with Vite as the build tool for fast development and hot module replacement
- **Component Library**: shadcn/ui components built on top of Radix UI primitives for accessible and customizable UI elements
- **Styling**: Tailwind CSS with custom CSS variables for theming and consistent design system
- **State Management**: TanStack Query (React Query) for server state management, caching, and data synchronization
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod validation for type-safe form management

The frontend uses a shared schema approach where TypeScript types are derived from the database schema, ensuring type consistency across the application.

### Backend Architecture
The server-side follows a RESTful API design pattern:

- **Framework**: Express.js with TypeScript for type safety
- **Database Layer**: Drizzle ORM with PostgreSQL for type-safe database operations
- **Database Provider**: Neon serverless PostgreSQL database
- **Validation**: Zod schemas for request/response validation
- **Storage Pattern**: Interface-based storage abstraction with both in-memory and database implementations

The API provides endpoints for employee CRUD operations and attendance record management with proper error handling and request logging.

### Database Design
The application uses PostgreSQL with two main entities:

- **Employees Table**: Stores employee information including unique employee IDs, names, designations, departments, and status
- **Attendance Records Table**: Stores monthly attendance data as JSON strings with calculated totals for on-duty days and overtime

The schema uses Drizzle ORM's declarative approach with automatic UUID generation and proper constraints.

### Data Flow Pattern
The application implements a standard client-server data flow:

1. React components trigger API calls through TanStack Query
2. Express routes validate requests using Zod schemas
3. Storage layer abstracts database operations
4. Drizzle ORM handles SQL generation and type safety
5. Results are cached on the client for optimal performance

### Development Environment
The project is configured for both development and production environments:

- **Development**: Vite dev server with HMR, concurrent client/server development
- **Build Process**: Vite for client bundling, esbuild for server compilation
- **Database Migrations**: Drizzle Kit for schema management and migrations
- **Type Safety**: Shared TypeScript configuration across client, server, and shared modules

## External Dependencies

### Core Framework Dependencies
- **@tanstack/react-query**: Client-side data fetching, caching, and synchronization
- **drizzle-orm**: Type-safe database ORM for PostgreSQL operations
- **@neondatabase/serverless**: Neon serverless PostgreSQL driver
- **express**: Node.js web application framework for API server
- **zod**: TypeScript-first schema declaration and validation

### UI and Styling Dependencies
- **@radix-ui/***: Collection of low-level UI primitives for accessible components
- **tailwindcss**: Utility-first CSS framework for styling
- **class-variance-authority**: Utility for creating variant-based component APIs
- **clsx**: Utility for conditional className joining

### Development and Build Tools
- **vite**: Fast build tool and development server for the frontend
- **typescript**: Static type checking for JavaScript
- **drizzle-kit**: CLI companion for Drizzle ORM migrations and introspection
- **esbuild**: Fast JavaScript bundler for server-side code

### Database and Session Management
- **connect-pg-simple**: PostgreSQL session store for Express sessions
- **@jridgewell/trace-mapping**: Source map utilities for debugging

The web application is designed to be deployed on platforms like Replit with PostgreSQL database provisioning through environment variables.

## Kotlin Desktop Application

### Features
- **Single File Implementation**: Complete application in `main.kt` following all requirements
- **Material 3 Design**: Strict adherence to Google Material 3 design guidelines
- **SQLite3 Storage**: Embedded database for all employee and attendance data
- **PDF Format Compliance**: Exact replication of South Asia Consultancy PDF layout
- **Export Functionality**: Generate XLSX and PDF files with identical formatting
- **Employee Management**: Add, edit, delete employees with required name field and optional designation/department
- **Attendance Tracking**: Monthly grid view with clickable cells for status entry (P, A, OT, blank)
- **Auto-calculations**: Automatic calculation of total on-duty days and overtime days

### Key Components
- **DatabaseManager**: SQLite operations for employees and attendance data
- **Employee Management**: CRUD operations with form validation
- **Attendance Grid**: Interactive monthly view matching PDF format exactly
- **Export System**: Excel and PDF generation with proper formatting
- **Material 3 UI**: Cards, dialogs, navigation bars following Material Design 3

### Dependencies
- Jetpack Compose Desktop with Material 3
- SQLite JDBC driver for database operations  
- Apache POI for Excel export functionality
- iText PDF for PDF generation
- Material Icons for consistent iconography

### Usage
1. Run the Kotlin application using the provided Gradle configuration
2. Add employees through the intuitive Material 3 interface
3. Navigate to attendance view to mark daily attendance
4. Export data in XLSX or PDF format matching the original template exactly

The application is designed to be deployed on platforms like Replit with PostgreSQL database provisioning through environment variables.