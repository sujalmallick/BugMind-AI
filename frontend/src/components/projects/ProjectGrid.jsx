import ProjectCard from "./ProjectCard";
import EmptyProjects from "./EmptyProjects";

export default function ProjectGrid({
  projects = [],
  onOpenProject,
  onCreateProject,
}) {
  if (projects.length === 0) {
    return (
      <EmptyProjects
        onCreateProject={onCreateProject}
      />
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          onOpen={onOpenProject}
        />
      ))}
    </div>
  );
}