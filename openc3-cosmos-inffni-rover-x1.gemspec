# encoding: ascii-8bit

# Create the overall gemspec
Gem::Specification.new do |s|
  s.name = 'openc3-cosmos-inffni-rover-x1'
  s.summary = 'OpenC3 openc3-cosmos-inffni-rover-x1 plugin'
  s.description = <<-EOF
    Plugin for the Inffni Rover X1 Robot Dog
  EOF
  s.licenses = 'MIT'
  s.authors = ['OpenC3']
  s.email = ['plugins@openc3.com']
  s.homepage = 'https://github.com/OpenC3/openc3-cosmos-inffni-rover-x1'
  s.platform = Gem::Platform::RUBY
  s.required_ruby_version = '>= 3.0'

  if ENV['VERSION']
    s.version = ENV['VERSION'].dup
  else
    time = Time.now.strftime("%Y%m%d%H%M%S")
    s.version = '0.0.0' + ".#{time}"
  end
  # Prefer pyproject.toml over requirements.txt
  python_dep_file = if File.exist?('pyproject.toml')
    'pyproject.toml'
  else
    'requirements.txt'
  end
  s.files = Dir.glob("{targets,lib,public,tools,microservices}/**/*") + %w(Rakefile README.md LICENSE.md plugin.txt) + [python_dep_file]

  s.metadata = {
    # These fields are used when you submit your plugin to our App Store at store.openc3.com
    # See this help page for more detail: https://store.openc3.com/help/guidelines
    "source_code_uri" => "https://github.com/OpenC3/openc3-cosmos-inffni-rover-x1",
    "openc3_store_title" => "inffni-rover-x1",
    "openc3_store_description" => "Interface and Control the Inffni Rover X1",
    "openc3_store_keywords" => "Inffni, Rover, X1, robot, dog",
    # "openc3_store_image" => "public/store_img.png",
    "openc3_cosmos_minimum_version" => "7.2.0", # OPTIONAL
    "openc3_store_access_type" => "public" # OPTIONAL
  }
end
