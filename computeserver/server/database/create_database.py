import sqlite3

conn = sqlite3.connect('users.db')
# conn = sqlite3.connect(':memory:')

cursor = conn.cursor()


cursor.execute("""CREATE TABLE Users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE
)""")


cursor.execute("""CREATE TABLE Projects (
    id TEXT PRIMARY KEY,
    ownerId TEXT,
    protobufBinary BLOB NOT NULL,
    FOREIGN KEY (ownerId) REFERENCES Users(id)
)""")




# cursor.execute("""CREATE TABLE Projects (
#     id TEXT PRIMARY KEY,
#     ownerId TEXT,
#     isAbsNode INTEGER,

#     FOREIGN KEY (ownerId) REFERENCES Users(id)
# )""")

# cursor.execute("""CREATE TABLE Commits (
#     id TEXT PRIMARY KEY,
#     message TEXT, 
#     timestamp INTEGER,
#     branchName TEXT,
#     prevCommitId TEXT,
#     nextCommitIds TEXT,

#     FOREIGN KEY (prevCommitId) REFERENCES Commits(id)
# )""")


# cursor.execute("""CREATE TABLE Branches (
#     id TEXT PRIMARY KEY,
#     name TEXT,
    
#     latestCommitId TEXT,
#     projectId TEXT,

#     FOREIGN KEY (latestCommitId) REFERENCES Commits(id),
#     FOREIGN KEY (projectId) REFERENCES Projects(id)

# )""")

