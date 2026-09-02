FROM ubuntu:24.04

RUN echo "This happened during image build"

CMD ["echo", "This happened when the container started"]
