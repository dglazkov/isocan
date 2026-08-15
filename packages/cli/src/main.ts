import { Command } from "commander";

const program = new Command();
program.name("isocan").description("Isomorphic canvas CLI").version("0.1.0");

program
  .command("status")
  .description("Show daemon status")
  .action(() => {
    console.log("isocan scaffold — daemon integration coming next");
  });

program.parse();
